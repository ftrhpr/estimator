// Export all services
export { AuthService } from './services/authService';
export { CustomerService } from './services/customerService';
export { IntakeService } from './services/intakeService';
export { ServiceService } from './services/serviceService';
export { StorageService } from './services/storageService';
export { VehicleService } from './services/vehicleService';
export { VisualEstimateService } from './services/visualEstimateService';

// Export all contexts
export { AuthProvider, useAuth } from './context/AuthContext';

// Export all components
export { CustomerCard } from './components/common/CustomerCard';
export { LoadingSpinner } from './components/common/LoadingSpinner';
export { PhotoAngleSelector } from './components/common/PhotoAngleSelector';
export { ServiceCard } from './components/common/ServiceCard';
export { VINScanner } from './components/common/VINScanner';
export { ServiceForm } from './components/forms/ServiceForm';

// Export all screens
export { CustomersScreen } from './screens/customers/CustomersScreen';
export { CustomerIntakeScreen } from './screens/estimates/CustomerIntakeScreen';
export { VisualEstimatorScreen } from './screens/estimates/VisualEstimatorScreen';
export { ServiceSettingsScreen } from './screens/services/ServiceSettingsScreen';

// Export all utilities
export * from './utils/helpers';

// Export all types
export * from './types';

// Export all constants
export * from './config/constants';
export * from './config/services';

// Export Firebase config
export { auth, db, storage } from './config/firebaseConfig';
