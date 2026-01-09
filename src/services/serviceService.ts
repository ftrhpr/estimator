import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { DEFAULT_SERVICES } from '../config/services';
import { Service } from '../types';

export class ServiceService {
  private static readonly COLLECTION_NAME = 'services';

  static async initializeDefaultServices(): Promise<void> {
    try {
      // Check if services already exist
      const existingServices = await this.getAllServices();
      if (existingServices.length > 0) {
        return; // Services already initialized
      }

      // Add default services
      const promises = Object.values(DEFAULT_SERVICES).map(async (service) => {
        const now = new Date();
        return await addDoc(collection(db, this.COLLECTION_NAME), {
          ...service,
          isActive: true,
          isDefault: true,
          createdAt: now,
          updatedAt: now,
        });
      });

      await Promise.all(promises);
      console.log('Default services initialized successfully');
    } catch (error) {
      console.error('Error initializing default services:', error);
      throw error;
    }
  }

  static async createService(serviceData: Omit<Service, 'id' | 'createdAt' | 'updatedAt' | 'isDefault'>): Promise<string> {
    try {
      const now = new Date();
      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), {
        ...serviceData,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating service:', error);
      throw error;
    }
  }

  static async updateService(id: string, updates: Partial<Service>): Promise<void> {
    try {
      const serviceRef = doc(db, this.COLLECTION_NAME, id);
      await updateDoc(serviceRef, {
        ...updates,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error updating service:', error);
      throw error;
    }
  }

  static async deleteService(id: string): Promise<void> {
    try {
      // Check if it's a default service first
      const service = await this.getService(id);
      if (service?.isDefault) {
        throw new Error('Cannot delete default services');
      }

      const serviceRef = doc(db, this.COLLECTION_NAME, id);
      await deleteDoc(serviceRef);
    } catch (error) {
      console.error('Error deleting service:', error);
      throw error;
    }
  }

  static async getService(id: string): Promise<Service | null> {
    try {
      const serviceRef = doc(db, this.COLLECTION_NAME, id);
      const docSnap = await getDoc(serviceRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Service;
      }
      return null;
    } catch (error) {
      console.error('Error getting service:', error);
      throw error;
    }
  }

  static async getAllServices(): Promise<Service[]> {
    try {
      // Simple query without compound index requirement
      const querySnapshot = await getDocs(collection(db, this.COLLECTION_NAME));
      
      return querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        }) as Service[])
        .filter(service => service.isActive)
        .sort((a, b) => a.nameEn.localeCompare(b.nameEn));
    } catch (error) {
      console.error('Error getting services:', error);
      throw error;
    }
  }

  static async getServicesByCategory(category: string): Promise<Service[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('category', '==', category),
        where('isActive', '==', true),
        orderBy('nameEn', 'asc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Service[];
    } catch (error) {
      console.error('Error getting services by category:', error);
      throw error;
    }
  }

  static async toggleServiceStatus(id: string): Promise<void> {
    try {
      const service = await this.getService(id);
      if (!service) {
        throw new Error('Service not found');
      }

      await this.updateService(id, {
        isActive: !service.isActive,
      });
    } catch (error) {
      console.error('Error toggling service status:', error);
      throw error;
    }
  }
}