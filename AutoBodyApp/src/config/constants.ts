// App configuration constants

export const APP_CONFIG = {
  name: 'AutoBody Estimator',
  version: '1.0.0',
  defaultTaxRate: 0.08, // 8% default tax rate
  currency: 'USD',
  currencySymbol: '$',
};

export const LABOR_RATES = {
  body: 65, // $65/hour for body work
  paint: 70, // $70/hour for paint work
  mechanical: 85, // $85/hour for mechanical work
  interior: 60, // $60/hour for interior work
  glass: 55, // $55/hour for glass work
};

export const DAMAGE_CATEGORIES = [
  { value: 'body', label: 'Body Work' },
  { value: 'paint', label: 'Paint' },
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'interior', label: 'Interior' },
  { value: 'glass', label: 'Glass' },
];

export const DAMAGE_SEVERITY = [
  { value: 'minor', label: 'Minor', multiplier: 1.0 },
  { value: 'moderate', label: 'Moderate', multiplier: 1.5 },
  { value: 'severe', label: 'Severe', multiplier: 2.0 },
];

export const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  // Add more states as needed
];

export const COLORS = {
  primary: '#1976D2',
  secondary: '#FFC107',
  error: '#F44336',
  warning: '#FF9800',
  success: '#4CAF50',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  text: {
    primary: '#212121',
    secondary: '#757575',
  },
};