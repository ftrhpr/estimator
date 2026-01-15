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
  makeId?: string;   // Car2DB make ID for reference
  modelId?: string;  // Car2DB model ID for reference
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

export interface Service {
  id: string;
  key: string;
  nameEn: string;
  nameKa: string;
  description?: string;
  basePrice: number;
  category: 'bodywork' | 'painting' | 'mechanical' | 'specialized' | 'finishing';
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
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

// Visual Estimate structure for similar repair matching
export interface VisualEstimate {
  id: string;
  vehicleModel: string;
  damageZone: string;
  cost: number;
  imageURL: string;
  repairType: string[];
  photoAngle: PhotoAngle;
  customerId?: string;
  vehicleId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PhotoAngle = 'Front' | 'Side' | 'Rear' | 'Damage Close-up';

export interface EstimatePhoto {
  id: string;
  url: string;
  angle: PhotoAngle;
  damageZone?: string;
  uploadedAt: Date;
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

export interface ServiceFormData {
  nameEn: string;
  nameKa: string;
  description?: string;
  basePrice: string;
  category: string;
}

export interface CustomerIntakeFormData {
  customerName: string;
  phoneNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vin: string;
}

export interface IntakeResult {
  customerId: string;
  vehicleId: string;
  customer: Customer;
  vehicle: Vehicle;
}

export interface InvoiceLineItem {
  id: string;
  type: 'service' | 'part';
  nameEn: string;
  nameKa: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  damageZone?: string;
}

export interface InvoiceData {
  id: string;
  invoiceNumber: string;
  customer: Customer;
  vehicle: Vehicle;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string;
  createdAt: Date;
}

export interface EstimateReviewData {
  customer: Customer;
  vehicle: Vehicle;
  visualEstimates: VisualEstimate[];
  selectedServices: Service[];
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}