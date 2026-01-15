import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

export interface Part {
  id?: string;
  name: string;
  nameKa?: string;
  nameEn?: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PartsService {
  private static readonly COLLECTION_NAME = 'parts';

  /**
   * Add a new part to the featured parts database
   */
  static async addPart(partData: Omit<Part, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const now = new Date();
      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), {
        ...partData,
        createdAt: now,
        updatedAt: now,
      });
      console.log('[PartsService] Part added successfully:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('[PartsService] Error adding part:', error);
      throw error;
    }
  }

  /**
   * Get all featured parts
   */
  static async getAllParts(): Promise<Part[]> {
    try {
      const q = query(collection(db, this.COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const parts: Part[] = [];
      querySnapshot.forEach((doc) => {
        parts.push({
          id: doc.id,
          ...doc.data(),
        } as Part);
      });
      
      console.log('[PartsService] Retrieved all parts:', parts.length);
      return parts;
    } catch (error) {
      console.error('[PartsService] Error getting all parts:', error);
      throw error;
    }
  }

  /**
   * Update a part
   */
  static async updatePart(id: string, updates: Partial<Part>): Promise<void> {
    try {
      const partRef = doc(db, this.COLLECTION_NAME, id);
      await updateDoc(partRef, {
        ...updates,
        updatedAt: new Date(),
      });
      console.log('[PartsService] Part updated:', id);
    } catch (error) {
      console.error('[PartsService] Error updating part:', error);
      throw error;
    }
  }

  /**
   * Delete a part
   */
  static async deletePart(id: string): Promise<void> {
    try {
      const partRef = doc(db, this.COLLECTION_NAME, id);
      await deleteDoc(partRef);
      console.log('[PartsService] Part deleted:', id);
    } catch (error) {
      console.error('[PartsService] Error deleting part:', error);
      throw error;
    }
  }

  /**
   * Check if a part with the same Georgian name already exists
   */
  static async partExists(nameKa: string): Promise<boolean> {
    try {
      const q = query(collection(db, this.COLLECTION_NAME));
      const querySnapshot = await getDocs(q);
      
      const exists = querySnapshot.docs.some((doc) => {
        const data = doc.data() as Part;
        return data.nameKa?.toLowerCase() === nameKa.toLowerCase();
      });
      
      return exists;
    } catch (error) {
      console.error('[PartsService] Error checking if part exists:', error);
      return false;
    }
  }
}
