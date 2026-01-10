import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getApps, initializeApp } from 'firebase/app';
import { syncInvoiceToCPanel } from './cpanelService';

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyBK7wfd2rC6uOedQwDWjPxDOoaBRIlT0Vo",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "autobodyestimator.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "autobodyestimator",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "autobodyestimator.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "873356644692",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:873356644692:web:382ddbb201905a3b6b38c1"
};

// Check if Firebase is configured
const isConfigured = firebaseConfig.apiKey && firebaseConfig.projectId;

if (!isConfigured) {
  console.error('❌ Firebase configuration is missing. Please check your .env file.');
} else {
  console.log('✅ Firebase configuration loaded successfully');
}

// Initialize Firebase only if not already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const storage = getStorage(app);

// Collections
export const COLLECTIONS = {
  INSPECTIONS: 'inspections',
};

// ==================== STORAGE FUNCTIONS ====================

/**
 * Upload a single image to Firebase Storage
 * @param {string} uri - Local image URI
 * @param {string} path - Storage path (e.g., 'inspections/123/photo1.jpg')
 * @returns {Promise<string>} Download URL
 */
export const uploadImage = async (uri, path) => {
  try {
    // Fetch the image as a blob
    const response = await fetch(uri);
    const blob = await response.blob();
    
    // Create storage reference
    const storageRef = ref(storage, path);
    
    // Upload the blob
    await uploadBytes(storageRef, blob);
    
    // Get and return the download URL
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

/**
 * Upload multiple images to Firebase Storage
 * @param {Array<{uri: string, label?: string}>} images - Array of image objects
 * @param {string} inspectionId - Inspection ID for folder organization
 * @returns {Promise<Array<{url: string, label?: string}>>} Array of uploaded image data
 */
export const uploadMultipleImages = async (images, inspectionId) => {
  try {
    const uploadPromises = images.map(async (image, index) => {
      const timestamp = Date.now();
      const fileName = `photo_${index}_${timestamp}.jpg`;
      const path = `inspections/${inspectionId}/${fileName}`;
      
      const downloadURL = await uploadImage(image.uri, path);
      
      return {
        url: downloadURL,
        label: image.label || `Photo ${index + 1}`,
        uploadedAt: new Date().toISOString(),
      };
    });
    
    // Upload all images in parallel using Promise.all
    const uploadedImages = await Promise.all(uploadPromises);
    return uploadedImages;
  } catch (error) {
    console.error('Error uploading multiple images:', error);
    throw error;
  }
};

/**
 * Delete an image from Firebase Storage
 * @param {string} downloadURL - Download URL of the image to delete
 */
export const deleteImage = async (downloadURL) => {
  try {
    const imageRef = ref(storage, downloadURL);
    await deleteObject(imageRef);
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
};

// ==================== FIRESTORE FUNCTIONS ====================

/**
 * Create a new inspection document
 * @param {Object} inspectionData - Inspection data
 * @returns {Promise<string>} Document ID
 */
export const createInspection = async (inspectionData) => {
  try {
    // Step 1: Save to Firebase (primary storage)
    const docRef = await addDoc(collection(db, COLLECTIONS.INSPECTIONS), {
      ...inspectionData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    
    const firebaseId = docRef.id;
    console.log('✅ Invoice saved to Firebase:', firebaseId);
    
    // Step 2: Sync to cPanel (non-blocking)
    // This runs in the background and won't block the user if it fails
    syncInvoiceToCPanel(inspectionData, firebaseId)
      .then(result => {
        if (result.success) {
          console.log('✅ Invoice synced to cPanel:', result.cpanelId);
          // Store the cPanel invoice ID in Firebase for future syncs
          if (result.cpanelId) {
            updateDoc(docRef, { cpanelInvoiceId: result.cpanelId })
              .then(() => console.log('✅ Stored cPanel invoice ID in Firebase'))
              .catch(err => console.error('⚠️ Failed to store cPanel ID:', err));
          }
        } else if (result.skipped) {
          console.log('⚠️ cPanel sync skipped:', result.reason);
        } else {
          console.error('❌ cPanel sync failed:', result.error);
        }
      })
      .catch(error => {
        console.error('❌ cPanel sync error:', error);
      });
    
    return firebaseId;
  } catch (error) {
    console.error('Error creating inspection:', error);
    throw error;
  }
};

/**
 * Get all inspections
 * @returns {Promise<Array>} Array of inspection documents
 */
export const getAllInspections = async () => {
  try {
    const q = query(
      collection(db, COLLECTIONS.INSPECTIONS),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const inspections = [];
    querySnapshot.forEach((doc) => {
      inspections.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    return inspections;
  } catch (error) {
    console.error('Error getting inspections:', error);
    throw error;
  }
};

/**
 * Get inspections by phone number
 * @param {string} phoneNumber - Customer phone number
 * @returns {Promise<Array>} Array of inspection documents
 */
export const getInspectionsByPhone = async (phoneNumber) => {
  try {
    const q = query(
      collection(db, COLLECTIONS.INSPECTIONS),
      where('customerPhone', '==', phoneNumber),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const inspections = [];
    querySnapshot.forEach((doc) => {
      inspections.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    return inspections;
  } catch (error) {
    console.error('Error getting inspections by phone:', error);
    throw error;
  }
};

/**
 * Update an inspection document
 * @param {string} inspectionId - Document ID
 * @param {Object} updates - Data to update
 * @param {string} cpanelInvoiceId - Optional cPanel invoice ID for syncing
 */
export const updateInspection = async (inspectionId, updates, cpanelInvoiceId = null) => {
  try {
    const docRef = doc(db, COLLECTIONS.INSPECTIONS, inspectionId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    
    console.log('✅ Invoice updated in Firebase:', inspectionId);
    
    // Step 2: Sync update to cPanel (non-blocking)
    // Only sync if we have a cPanel invoice ID
    if (cpanelInvoiceId && updates) {
      syncUpdateToCPanel(cpanelInvoiceId, updates)
        .then(result => {
          if (result.success) {
            console.log('✅ Invoice update synced to cPanel:', cpanelInvoiceId);
          } else if (result.skipped) {
            console.log('⚠️ cPanel update skipped:', result.reason);
          } else {
            console.error('❌ cPanel update failed:', result.error);
          }
        })
        .catch(error => {
          console.error('❌ cPanel update error:', error);
        });
    }
  } catch (error) {
    console.error('Error updating inspection:', error);
    throw error;
  }
};

/**
 * Helper function to sync updates to cPanel
 * @param {string} cpanelInvoiceId - cPanel invoice ID
 * @param {Object} updates - Updates to sync
 */
const syncUpdateToCPanel = async (cpanelInvoiceId, updates) => {
  try {
    console.log('[Firebase] Syncing update to cPanel:', { cpanelInvoiceId, updates });
    const { updateInvoiceToCPanel } = await import('./cpanelService');
    const result = await updateInvoiceToCPanel(cpanelInvoiceId, updates);
    console.log('[Firebase] cPanel update result:', result);
    return result;
  } catch (error) {
    console.error('Error syncing update to cPanel:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Delete an inspection document
 * @param {string} inspectionId - Document ID
 */
export const deleteInspection = async (inspectionId) => {
  try {
    const docRef = doc(db, COLLECTIONS.INSPECTIONS, inspectionId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting inspection:', error);
    throw error;
  }
};

/**
 * Complete workflow: Upload images and save inspection
 * @param {Object} params
 * @param {Array} params.photos - Array of photo URIs or objects with uri and label
 * @param {Array} params.damageData - Damage assessment data
 * @param {string} params.customerName - Customer name
 * @param {string} params.customerPhone - Customer phone number
 * @param {string} params.carModel - Car model
 * @param {string} params.plate - License plate number
 * @param {number} params.totalPrice - Total estimate price
 * @returns {Promise<string>} Inspection document ID
 */
export const saveInspectionWithImages = async ({
  photos,
  photoData = [],
  damageData,
  customerName,
  customerPhone,
  carModel,
  plate,
  totalPrice,
}) => {
  try {
    // Step 1: Create a temporary inspection ID
    const tempId = `temp_${Date.now()}`;
    
    // Step 2: Prepare image data
    const imageObjects = photos.map((photo, index) => ({
      uri: typeof photo === 'string' ? photo : photo.uri,
      label: photoData[index]?.label || `Photo ${index + 1}`,
    }));
    
    // Step 3: Upload all images in parallel
    console.log('Uploading images...');
    const uploadedImages = await uploadMultipleImages(imageObjects, tempId);
    
    // Step 4: Group damage data by car part
    const partsByName = {};
    damageData.forEach(damage => {
      if (!partsByName[damage.part]) {
        partsByName[damage.part] = {
          partName: damage.part,
          damages: [],
        };
      }
      
      partsByName[damage.part].damages.push({
        pinNumber: partsByName[damage.part].damages.length + 1,
        photoIndex: damage.photoId,
        x: damage.x,
        y: damage.y,
        services: damage.services,
      });
    });
    
    const parts = Object.values(partsByName);
    
    // Step 5: Create the inspection document
    const inspectionData = {
      customerName,
      customerPhone,
      carModel,
      plate: plate || carModel,
      totalPrice,
      parts,
      photos: uploadedImages,
      totalDamagePoints: damageData.length,
      status: 'Pending',
    };
    
    console.log('Saving to Firestore...');
    const docId = await createInspection(inspectionData);
    
    console.log('Inspection saved successfully:', docId);
    return docId;
  } catch (error) {
    console.error('Error saving inspection with images:', error);
    throw error;
  }
};

export { db, storage };
