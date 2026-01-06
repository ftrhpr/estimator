import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { Customer } from '../types';

export class CustomerService {
  private static readonly COLLECTION_NAME = 'customers';

  static async createCustomer(customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const now = new Date();
      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), {
        ...customerData,
        createdAt: now,
        updatedAt: now,
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  }

  static async updateCustomer(id: string, updates: Partial<Customer>): Promise<void> {
    try {
      const customerRef = doc(db, this.COLLECTION_NAME, id);
      await updateDoc(customerRef, {
        ...updates,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }

  static async deleteCustomer(id: string): Promise<void> {
    try {
      const customerRef = doc(db, this.COLLECTION_NAME, id);
      await deleteDoc(customerRef);
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  }

  static async getCustomer(id: string): Promise<Customer | null> {
    try {
      const customerRef = doc(db, this.COLLECTION_NAME, id);
      const docSnap = await getDoc(customerRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Customer;
      }
      return null;
    } catch (error) {
      console.error('Error getting customer:', error);
      throw error;
    }
  }

  static async getAllCustomers(): Promise<Customer[]> {
    try {
      const q = query(collection(db, this.COLLECTION_NAME), orderBy('lastName', 'asc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Customer[];
    } catch (error) {
      console.error('Error getting customers:', error);
      throw error;
    }
  }

  static async searchCustomers(searchTerm: string): Promise<Customer[]> {
    try {
      // Note: For full-text search, you might want to use a service like Algolia
      // This is a basic search implementation
      const customers = await this.getAllCustomers();
      
      const filteredCustomers = customers.filter(customer => 
        customer.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.includes(searchTerm)
      );
      
      return filteredCustomers;
    } catch (error) {
      console.error('Error searching customers:', error);
      throw error;
    }
  }
}