// Export all services
export { CustomerService } from './services/customerService';
export { AuthService } from './services/authService';

// Export all contexts
export { AuthProvider, useAuth } from './context/AuthContext';

// Export all components
export { LoadingSpinner } from './components/common/LoadingSpinner';
export { CustomerCard } from './components/common/CustomerCard';

// Export all screens
export { CustomersScreen } from './screens/customers/CustomersScreen';

// Export all utilities
export * from './utils/helpers';

// Export all types
export * from './types';

// Export all constants
export * from './config/constants';

// Export Firebase config
export { auth, db, storage } from './config/firebaseConfig';