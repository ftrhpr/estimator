/**
 * Car Database Service
 * Manages car makes and models in Firebase with local caching
 * Syncs data from Car2DB API and stores in Firestore for offline access
 */

import { collection, doc, getDoc, getDocs, query, setDoc, Timestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { CarMake, CarModel, fetchCarMakes, fetchCarModels } from './carApiService';

// Collection names
const COLLECTIONS = {
  CAR_MAKES: 'car_makes',
  CAR_MODELS: 'car_models',
  CAR_SYNC_META: 'car_sync_meta',
};

// Cache duration: 7 days
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export interface CarMakeDoc extends CarMake {
  createdAt: Date;
  updatedAt: Date;
}

export interface CarModelDoc extends CarModel {
  makeName?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SyncMeta {
  lastSyncAt: Date;
  makesCount: number;
  modelsCount: number;
}

/**
 * Check if car data needs to be synced from API
 */
export const needsSync = async (): Promise<boolean> => {
  try {
    const metaRef = doc(db, COLLECTIONS.CAR_SYNC_META, 'sync_status');
    const metaDoc = await getDoc(metaRef);
    
    if (!metaDoc.exists()) {
      console.log('[CarDB] No sync metadata found, sync needed');
      return true;
    }
    
    const data = metaDoc.data() as SyncMeta;
    const lastSync = data.lastSyncAt instanceof Timestamp 
      ? data.lastSyncAt.toDate() 
      : new Date(data.lastSyncAt);
    
    const timeSinceSync = Date.now() - lastSync.getTime();
    const needsRefresh = timeSinceSync > CACHE_DURATION_MS;
    
    console.log(`[CarDB] Last sync: ${lastSync.toISOString()}, needs refresh: ${needsRefresh}`);
    return needsRefresh;
  } catch (error) {
    console.error('[CarDB] Error checking sync status:', error);
    return true;
  }
};

/**
 * Sync car makes and models from API to Firebase
 * This should be called periodically or when data is stale
 */
export const syncCarDataFromAPI = async (forceSync = false): Promise<{ makes: number; models: number }> => {
  try {
    // Check if sync is needed
    if (!forceSync && !(await needsSync())) {
      console.log('[CarDB] Data is fresh, skipping sync');
      const meta = await getSyncMeta();
      return { makes: meta?.makesCount || 0, models: meta?.modelsCount || 0 };
    }
    
    console.log('[CarDB] Starting sync from Car2DB API...');
    
    // Fetch data from API
    const [makes, models] = await Promise.all([
      fetchCarMakes(),
      fetchCarModels(),
    ]);
    
    console.log(`[CarDB] Fetched ${makes.length} makes and ${models.length} models from API`);
    
    // Create a map of make IDs to names for model enrichment
    const makeMap = new Map(makes.map(m => [m.id, m.name]));
    
    // Save makes to Firebase using batched writes
    const batch = writeBatch(db);
    const now = new Date();
    
    // Save makes (in batches of 500 - Firestore limit)
    let makeCount = 0;
    for (const make of makes) {
      const makeRef = doc(db, COLLECTIONS.CAR_MAKES, make.id);
      batch.set(makeRef, {
        ...make,
        createdAt: now,
        updatedAt: now,
      });
      makeCount++;
    }
    
    await batch.commit();
    console.log(`[CarDB] Saved ${makeCount} makes to Firebase`);
    
    // Save models in multiple batches (500 per batch limit)
    const BATCH_SIZE = 450; // Leave some room
    let modelCount = 0;
    
    for (let i = 0; i < models.length; i += BATCH_SIZE) {
      const modelBatch = writeBatch(db);
      const slice = models.slice(i, i + BATCH_SIZE);
      
      for (const model of slice) {
        const modelRef = doc(db, COLLECTIONS.CAR_MODELS, model.id);
        modelBatch.set(modelRef, {
          ...model,
          makeName: makeMap.get(model.makeId) || '',
          createdAt: now,
          updatedAt: now,
        });
        modelCount++;
      }
      
      await modelBatch.commit();
      console.log(`[CarDB] Saved batch ${Math.floor(i / BATCH_SIZE) + 1}, total models: ${modelCount}`);
    }
    
    // Update sync metadata
    const metaRef = doc(db, COLLECTIONS.CAR_SYNC_META, 'sync_status');
    await setDoc(metaRef, {
      lastSyncAt: now,
      makesCount: makeCount,
      modelsCount: modelCount,
    });
    
    console.log(`[CarDB] Sync complete: ${makeCount} makes, ${modelCount} models`);
    return { makes: makeCount, models: modelCount };
  } catch (error) {
    console.error('[CarDB] Error syncing car data:', error);
    throw error;
  }
};

/**
 * Get sync metadata
 */
export const getSyncMeta = async (): Promise<SyncMeta | null> => {
  try {
    const metaRef = doc(db, COLLECTIONS.CAR_SYNC_META, 'sync_status');
    const metaDoc = await getDoc(metaRef);
    
    if (!metaDoc.exists()) return null;
    
    return metaDoc.data() as SyncMeta;
  } catch (error) {
    console.error('[CarDB] Error getting sync meta:', error);
    return null;
  }
};

/**
 * Get all car makes from Firebase
 */
export const getAllMakes = async (): Promise<CarMakeDoc[]> => {
  try {
    const makesRef = collection(db, COLLECTIONS.CAR_MAKES);
    const snapshot = await getDocs(makesRef);
    
    const makes: CarMakeDoc[] = [];
    snapshot.forEach(doc => {
      makes.push({ id: doc.id, ...doc.data() } as CarMakeDoc);
    });
    
    // Sort alphabetically
    makes.sort((a, b) => a.name.localeCompare(b.name));
    
    console.log(`[CarDB] Retrieved ${makes.length} makes from Firebase`);
    return makes;
  } catch (error) {
    console.error('[CarDB] Error getting makes:', error);
    throw error;
  }
};

/**
 * Get models for a specific make from Firebase
 */
export const getModelsForMake = async (makeId: string): Promise<CarModelDoc[]> => {
  try {
    const modelsRef = collection(db, COLLECTIONS.CAR_MODELS);
    const q = query(modelsRef, where('makeId', '==', makeId));
    const snapshot = await getDocs(q);
    
    const models: CarModelDoc[] = [];
    snapshot.forEach(doc => {
      models.push({ id: doc.id, ...doc.data() } as CarModelDoc);
    });
    
    // Sort alphabetically
    models.sort((a, b) => a.name.localeCompare(b.name));
    
    console.log(`[CarDB] Retrieved ${models.length} models for make ${makeId}`);
    return models;
  } catch (error) {
    console.error('[CarDB] Error getting models for make:', error);
    throw error;
  }
};

/**
 * Search makes by name
 */
export const searchMakes = async (searchQuery: string): Promise<CarMakeDoc[]> => {
  try {
    // Firebase doesn't support native text search, so we fetch all and filter
    const allMakes = await getAllMakes();
    
    if (!searchQuery.trim()) return allMakes;
    
    const lowerQuery = searchQuery.toLowerCase();
    return allMakes.filter(make => 
      make.name.toLowerCase().includes(lowerQuery)
    );
  } catch (error) {
    console.error('[CarDB] Error searching makes:', error);
    throw error;
  }
};

/**
 * Get a single make by ID
 */
export const getMakeById = async (makeId: string): Promise<CarMakeDoc | null> => {
  try {
    const makeRef = doc(db, COLLECTIONS.CAR_MAKES, makeId);
    const makeDoc = await getDoc(makeRef);
    
    if (!makeDoc.exists()) return null;
    
    return { id: makeDoc.id, ...makeDoc.data() } as CarMakeDoc;
  } catch (error) {
    console.error('[CarDB] Error getting make by ID:', error);
    return null;
  }
};

/**
 * Get a single model by ID
 */
export const getModelById = async (modelId: string): Promise<CarModelDoc | null> => {
  try {
    const modelRef = doc(db, COLLECTIONS.CAR_MODELS, modelId);
    const modelDoc = await getDoc(modelRef);
    
    if (!modelDoc.exists()) return null;
    
    return { id: modelDoc.id, ...modelDoc.data() } as CarModelDoc;
  } catch (error) {
    console.error('[CarDB] Error getting model by ID:', error);
    return null;
  }
};

/**
 * Add a custom model for a specific make
 * Used when user enters a model that doesn't exist in the database
 */
export const addCustomModel = async (makeId: string, makeName: string, modelName: string): Promise<CarModelDoc> => {
  try {
    const now = new Date();
    // Generate a unique ID for the custom model
    const customId = `custom_${makeId}_${modelName.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`;
    
    const modelDoc: CarModelDoc = {
      id: customId,
      name: modelName.trim(),
      makeId: makeId,
      makeName: makeName,
      createdAt: now,
      updatedAt: now,
    };
    
    const modelRef = doc(db, COLLECTIONS.CAR_MODELS, customId);
    await setDoc(modelRef, {
      ...modelDoc,
      isCustom: true, // Flag to identify custom entries
    });
    
    console.log(`[CarDB] Added custom model: ${modelName} for make ${makeName}`);
    return modelDoc;
  } catch (error) {
    console.error('[CarDB] Error adding custom model:', error);
    throw error;
  }
};

/**
 * Initialize car data - call on app startup
 * This checks if data needs to be synced and syncs if necessary
 */
export const initializeCarData = async (): Promise<void> => {
  try {
    const needs = await needsSync();
    
    if (needs) {
      console.log('[CarDB] Initializing car data from API...');
      await syncCarDataFromAPI(true);
    } else {
      console.log('[CarDB] Car data is already synced');
    }
  } catch (error) {
    console.error('[CarDB] Error initializing car data:', error);
    // Don't throw - allow app to continue without car data
  }
};

export default {
  initializeCarData,
  syncCarDataFromAPI,
  getAllMakes,
  getModelsForMake,
  searchMakes,
  getMakeById,
  getModelById,
  addCustomModel,
  needsSync,
  getSyncMeta,
};
