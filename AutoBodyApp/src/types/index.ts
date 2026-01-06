// TypeScript type definitions for the Auto Body App

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Vehicle {
  id: string;
  customerId: string;
  make: string;
  model: string;
  year: number;
  color: string;
  vin?: string;
  licensePlate?: string;
  mileage?: number;
}

export interface DamageItem {
  id: string;
  description: string;
  category: 'body' | 'paint' | 'mechanical' | 'interior' | 'glass';
  severity: 'minor' | 'moderate' | 'severe';
  laborHours: number;
  laborRate: number;
  partsRequired: Part[];
  photos: string[]; // URLs to damage photos
}

export interface Part {
  id: string;
  name: string;
  partNumber?: string;
  cost: number;
  quantity: number;
  supplier?: string;
}

export interface Estimate {
  id: string;
  customerId: string;
  vehicleId: string;
  estimateNumber: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  damageItems: DamageItem[];
  laborTotal: number;
  partsTotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  photos: string[]; // URLs to estimate photos
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface Invoice {
  id: string;
  estimateId: string;
  customerId: string;
  vehicleId: string;
  invoiceNumber: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  dueDate: Date;
  paidAt?: Date;
  paymentMethod?: 'cash' | 'check' | 'credit_card' | 'bank_transfer';
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'employee';
  createdAt: Date;
}

// Navigation types
export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Register: undefined;
  Customers: undefined;
  CustomerDetails: { customerId: string };
  AddCustomer: undefined;
  Estimates: undefined;
  EstimateDetails: { estimateId: string };
  CreateEstimate: { customerId?: string };
  Invoices: undefined;
  InvoiceDetails: { invoiceId: string };
  Settings: undefined;
};

// Form types
export interface CustomerFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface VehicleFormData {
  make: string;
  model: string;
  year: string;
  color: string;
  vin: string;
  licensePlate: string;
  mileage: string;
}