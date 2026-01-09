import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { VisualEstimate, Vehicle } from '../types';

export class VisualEstimateService {
  private static readonly COLLECTION_NAME = 'visual-estimates';

  /**
   * Create a new visual estimate entry
   */
  static async createVisualEstimate(
    estimateData: Omit<VisualEstimate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const now = new Date();
      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), {
        ...estimateData,
        createdAt: now,
        updatedAt: now,
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating visual estimate:', error);
      throw error;
    }
  }

  /**
   * Update a visual estimate
   */
  static async updateVisualEstimate(
    id: string, 
    updates: Partial<VisualEstimate>
  ): Promise<void> {
    try {
      const estimateRef = doc(db, this.COLLECTION_NAME, id);
      await updateDoc(estimateRef, {
        ...updates,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error updating visual estimate:', error);
      throw error;
    }
  }

  /**
   * Delete a visual estimate
   */
  static async deleteVisualEstimate(id: string): Promise<void> {
    try {
      const estimateRef = doc(db, this.COLLECTION_NAME, id);
      await deleteDoc(estimateRef);
    } catch (error) {
      console.error('Error deleting visual estimate:', error);
      throw error;
    }
  }

  /**
   * Get a visual estimate by ID
   */
  static async getVisualEstimate(id: string): Promise<VisualEstimate | null> {
    try {
      const estimateRef = doc(db, this.COLLECTION_NAME, id);
      const docSnap = await getDoc(estimateRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as VisualEstimate;
      }
      return null;
    } catch (error) {
      console.error('Error getting visual estimate:', error);
      throw error;
    }
  }

  /**
   * Get all visual estimates
   */
  static async getAllVisualEstimates(): Promise<VisualEstimate[]> {
    try {
      const q = query(collection(db, this.COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as VisualEstimate[];
    } catch (error) {
      console.error('Error getting visual estimates:', error);
      throw error;
    }
  }

  /**
   * Find similar repairs based on vehicle model and damage zone
   */
  static async findSimilarRepairs(
    vehicleModel: string, 
    damageZone: string, 
    maxResults: number = 10
  ): Promise<VisualEstimate[]> {
    try {
      // Simple query without compound index requirement
      const querySnapshot = await getDocs(collection(db, this.COLLECTION_NAME));
      
      return querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        }) as VisualEstimate[])
        .filter(estimate => 
          estimate.vehicleModel === vehicleModel && 
          estimate.damageZone === damageZone
        )
        .sort((a, b) => a.cost - b.cost)
        .slice(0, maxResults);
    } catch (error) {
      console.error('Error finding similar repairs:', error);
      throw error;
    }
  }

  /**
   * Get estimates by vehicle model
   */
  static async getEstimatesByVehicleModel(vehicleModel: string): Promise<VisualEstimate[]> {
    try {
      // Simple query without compound index requirement
      const querySnapshot = await getDocs(collection(db, this.COLLECTION_NAME));
      
      return querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        }) as VisualEstimate[])
        .filter(estimate => estimate.vehicleModel === vehicleModel)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error getting estimates by vehicle model:', error);
      throw error;
    }
  }

  /**
   * Get estimates by damage zone
   */
  static async getEstimatesByDamageZone(damageZone: string): Promise<VisualEstimate[]> {
    try {
      // Simple query without compound index requirement
      const querySnapshot = await getDocs(collection(db, this.COLLECTION_NAME));
      
      return querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        }) as VisualEstimate[])
        .filter(estimate => estimate.damageZone === damageZone)
        .sort((a, b) => a.cost - b.cost);
    } catch (error) {
      console.error('Error getting estimates by damage zone:', error);
      throw error;
    }
  }

  /**
   * Get average cost for similar repairs
   */
  static async getAverageCost(vehicleModel: string, damageZone: string): Promise<{
    average: number;
    min: number;
    max: number;
    count: number;
  } | null> {
    try {
      const estimates = await this.findSimilarRepairs(vehicleModel, damageZone, 100);
      
      if (estimates.length === 0) {
        return null;
      }

      const costs = estimates.map(est => est.cost);
      const average = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
      const min = Math.min(...costs);
      const max = Math.max(...costs);

      return {
        average: Math.round(average * 100) / 100,
        min,
        max,
        count: estimates.length,
      };
    } catch (error) {
      console.error('Error calculating average cost:', error);
      throw error;
    }
  }

  /**
   * Create visual estimate from vehicle and damage info
   */
  static async createEstimateFromVehicle(
    vehicle: Vehicle,
    damageZone: string,
    cost: number,
    imageURL: string,
    repairType: string[],
    photoAngle: VisualEstimate['photoAngle']
  ): Promise<string> {
    const estimateData = {
      vehicleModel: `${vehicle.make} ${vehicle.model}`,
      damageZone,
      cost,
      imageURL,
      repairType,
      photoAngle,
      customerId: vehicle.customerId,
      vehicleId: vehicle.id,
    };

    return await this.createVisualEstimate(estimateData);
  }
}