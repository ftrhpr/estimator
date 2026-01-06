// Export all services
export { CustomerService } from './services/customerService';
export { AuthService } from './services/authService';
export { ServiceService } from './services/serviceService';
export { VehicleService } from './services/vehicleService';
export { IntakeService } from './services/intakeService';

// Export all contexts
export { AuthProvider, useAuth } from './context/AuthContext';

// Export all components
export { LoadingSpinner } from './components/common/LoadingSpinner';
export { CustomerCard } from './components/common/CustomerCard';
export { ServiceCard } from './components/common/ServiceCard';
export { VINScanner } from './components/common/VINScanner';
export { ServiceForm } from './components/forms/ServiceForm';

// Export all screens
export { CustomersScreen } from './screens/customers/CustomersScreen';
export { ServiceSettingsScreen } from './screens/services/ServiceSettingsScreen';
export { CustomerIntakeScreen } from './screens/estimates/CustomerIntakeScreen';

// Export all utilities
export * from './utils/helpers';

// Export all types
export * from './types';

// Export all constants
export * from './config/constants';
export * from './config/services';

// Export Firebase config
export { auth, db, storage } from './config/firebaseConfig';