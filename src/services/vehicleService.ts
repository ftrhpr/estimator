import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { Vehicle } from '../types';

export class VehicleService {
  private static readonly COLLECTION_NAME = 'vehicles';

  static async createVehicle(vehicleData: Omit<Vehicle, 'id'>): Promise<string> {
    try {
      // Remove undefined values to prevent Firebase errors
      const sanitizedData = Object.fromEntries(
        Object.entries(vehicleData).filter(([_, value]) => value !== undefined)
      );
      
      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), sanitizedData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating vehicle:', error);
      throw error;
    }
  }

  static async updateVehicle(id: string, updates: Partial<Vehicle>): Promise<void> {
    try {
      // Remove undefined values to prevent Firebase errors
      const sanitizedUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );
      
      const vehicleRef = doc(db, this.COLLECTION_NAME, id);
      await updateDoc(vehicleRef, sanitizedUpdates);
    } catch (error) {
      console.error('Error updating vehicle:', error);
      throw error;
    }
  }

  static async deleteVehicle(id: string): Promise<void> {
    try {
      const vehicleRef = doc(db, this.COLLECTION_NAME, id);
      await deleteDoc(vehicleRef);
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      throw error;
    }
  }

  static async getVehicle(id: string): Promise<Vehicle | null> {
    try {
      const vehicleRef = doc(db, this.COLLECTION_NAME, id);
      const docSnap = await getDoc(vehicleRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Vehicle;
      }
      return null;
    } catch (error) {
      console.error('Error getting vehicle:', error);
      throw error;
    }
  }

  static async getCustomerVehicles(customerId: string): Promise<Vehicle[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME), 
        where('customerId', '==', customerId),
        orderBy('year', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Vehicle[];
    } catch (error) {
      console.error('Error getting customer vehicles:', error);
      throw error;
    }
  }

  static async getAllVehicles(): Promise<Vehicle[]> {
    try {
      const q = query(collection(db, this.COLLECTION_NAME), orderBy('year', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Vehicle[];
    } catch (error) {
      console.error('Error getting vehicles:', error);
      throw error;
    }
  }

  static async searchVehiclesByVIN(vin: string): Promise<Vehicle[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('vin', '==', vin.toUpperCase())
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Vehicle[];
    } catch (error) {
      console.error('Error searching vehicles by VIN:', error);
      throw error;
    }
  }

  static validateVIN(vin: string): boolean {
    // Basic VIN validation - should be 17 characters, no I, O, or Q
    if (!vin || vin.length !== 17) return false;
    const cleanVin = vin.toUpperCase();
    const invalidChars = /[IOQ]/;
    return !invalidChars.test(cleanVin);
  }

  static formatVIN(vin: string): string {
    return vin.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
}