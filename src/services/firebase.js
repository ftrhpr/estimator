import { getApps, initializeApp } from 'firebase/app';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
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

/**
 * Upload a voice note to Firebase Storage
 * @param {string} uri - Local audio file URI
 * @param {string} inspectionId - Inspection ID for folder organization
 * @returns {Promise<string>} Download URL
 */
export const uploadVoiceNoteToStorage = async (uri, inspectionId) => {
  try {
    console.log('[Firebase] Uploading voice note from:', uri);
    
    // Fetch the audio file as a blob
    const response = await fetch(uri);
    const blob = await response.blob();
    
    // Create unique filename with timestamp
    const timestamp = Date.now();
    const fileName = `voice_note_${timestamp}.m4a`;
    const path = `inspections/${inspectionId}/voice_notes/${fileName}`;
    
    // Create storage reference
    const storageRef = ref(storage, path);
    
    // Upload the blob
    await uploadBytes(storageRef, blob);
    
    // Get and return the download URL
    const downloadURL = await getDownloadURL(storageRef);
    console.log('[Firebase] Voice note uploaded successfully:', downloadURL);
    
    return downloadURL;
  } catch (error) {
    console.error('[Firebase] Error uploading voice note:', error);
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
    syncToCPanel(inspectionId, updates, cpanelInvoiceId, docRef)
      .then(result => {
        if (result.success) {
          console.log('✅ Invoice synced to cPanel:', result.cpanelId || cpanelInvoiceId);
        } else if (result.skipped) {
          console.log('⚠️ cPanel sync skipped:', result.reason);
        } else {
          console.error('❌ cPanel sync failed:', result.error);
        }
      })
      .catch(error => {
        console.error('❌ cPanel sync error:', error);
      });
  } catch (error) {
    console.error('Error updating inspection:', error);
    throw error;
  }
};

/**
 * Helper function to sync to cPanel (update existing or create new)
 * @param {string} inspectionId - Firebase document ID
 * @param {Object} updates - Updates to sync
 * @param {string} cpanelInvoiceId - Optional cPanel invoice ID
 * @param {Object} docRef - Firestore document reference
 */
const syncToCPanel = async (inspectionId, updates, cpanelInvoiceId, docRef) => {
  try {
    const { updateInvoiceToCPanel, fetchCPanelInvoiceId, syncInvoiceToCPanel, isCPanelConfigured } = await import('./cpanelService');
    
    if (!isCPanelConfigured()) {
      return { success: false, skipped: true, reason: 'cPanel not configured' };
    }
    
    let cpanelId = cpanelInvoiceId;
    
    // If no cPanel ID provided, try to fetch it from cPanel
    if (!cpanelId) {
      console.log('[Firebase] No cPanel ID provided, fetching from cPanel...');
      cpanelId = await fetchCPanelInvoiceId(inspectionId);
      
      // If found, save it to Firebase for future use
      if (cpanelId && docRef) {
        try {
          await updateDoc(docRef, { cpanelInvoiceId: cpanelId });
          console.log('[Firebase] Saved cPanel ID to Firebase:', cpanelId);
        } catch (err) {
          console.warn('[Firebase] Failed to save cPanel ID:', err);
        }
      }
    }
    
    // If we have a cPanel ID, update the existing record
    if (cpanelId) {
      console.log('[Firebase] Updating existing cPanel record:', cpanelId);
      
      // Map Firebase field names to cPanel field names
      const cpanelUpdates = {
        ...updates,
        // Map carMake/carModel to vehicleMake/vehicleModel for cPanel
        vehicleMake: updates.carMake || updates.vehicleMake || '',
        vehicleModel: updates.carModel || updates.vehicleModel || '',
      };
      
      console.log('[Firebase] cPanel updates with vehicle info:', {
        vehicleMake: cpanelUpdates.vehicleMake,
        vehicleModel: cpanelUpdates.vehicleModel,
        plate: cpanelUpdates.plate,
      });
      
      // Log services data if present
      if (cpanelUpdates.services) {
        console.log('[Firebase] Services count:', cpanelUpdates.services.length);
        cpanelUpdates.services.forEach((s, i) => {
          console.log(`[Firebase] Service ${i}:`, {
            serviceName: s.serviceName,
            serviceNameKa: s.serviceNameKa,
            name: s.name,
            nameKa: s.nameKa,
            price: s.price,
          });
        });
      }
      
      const result = await updateInvoiceToCPanel(cpanelId, cpanelUpdates);
      
      // If invoice not found in cPanel, create it instead
      if (!result.success && result.error && result.error.includes('not found')) {
        console.log('[Firebase] cPanel invoice not found, creating new one...');
        const { getDoc } = await import('firebase/firestore');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const fullData = { ...docSnap.data(), ...updates };
          const createResult = await syncInvoiceToCPanel(fullData, inspectionId);
          
          // Save the new cPanel ID to Firebase
          if (createResult.success && createResult.cpanelId) {
            try {
              await updateDoc(docRef, { cpanelInvoiceId: createResult.cpanelId });
              console.log('[Firebase] Saved new cPanel ID to Firebase:', createResult.cpanelId);
            } catch (err) {
              console.warn('[Firebase] Failed to save new cPanel ID:', err);
            }
          }
          
          return createResult;
        }
      }
      
      return { ...result, cpanelId };
    }
    
    // If no cPanel ID found, create a new record
    console.log('[Firebase] No cPanel record found, creating new one...');
    
    // Get full document data for creating new record
    const { getDoc } = await import('firebase/firestore');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const fullData = { ...docSnap.data(), ...updates };
      const createResult = await syncInvoiceToCPanel(fullData, inspectionId);
      
      // Save the new cPanel ID to Firebase
      if (createResult.success && createResult.cpanelId) {
        try {
          await updateDoc(docRef, { cpanelInvoiceId: createResult.cpanelId });
          console.log('[Firebase] Saved new cPanel ID to Firebase:', createResult.cpanelId);
        } catch (err) {
          console.warn('[Firebase] Failed to save new cPanel ID:', err);
        }
      }
      
      return createResult;
    }
    
    return { success: false, error: 'Document not found' };
  } catch (error) {
    console.error('[Firebase] Error in syncToCPanel:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete an inspection document
 * @param {string} inspectionId - Document ID
 */
export const deleteInspection = async (inspectionId) => {
  try {
    console.log('[Firebase] deleteInspection called with ID:', inspectionId);
    
    if (!inspectionId) {
      throw new Error('No inspection ID provided');
    }
    
    const docRef = doc(db, COLLECTIONS.INSPECTIONS, inspectionId);
    console.log('[Firebase] Deleting document from collection:', COLLECTIONS.INSPECTIONS);
    
    // First, verify the document exists
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      console.log('[Firebase] Document does not exist, may have been deleted already:', inspectionId);
      return { success: true, id: inspectionId, alreadyDeleted: true };
    }
    
    console.log('[Firebase] Document exists, proceeding with delete...');
    
    // Delete the document
    await deleteDoc(docRef);
    
    // Verify deletion by trying to read it again
    const verifySnap = await getDoc(docRef);
    if (verifySnap.exists()) {
      console.error('[Firebase] Document still exists after delete! This may be a permissions issue.');
      throw new Error('Delete failed - document still exists. Check Firebase security rules.');
    }
    
    console.log('[Firebase] Document deleted and verified successfully:', inspectionId);
    return { success: true, id: inspectionId };
  } catch (error) {
    console.error('[Firebase] Error deleting inspection:', error);
    console.error('[Firebase] Error details:', error.message);
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
