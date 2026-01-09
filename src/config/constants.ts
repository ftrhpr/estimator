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
  primary: '#2563EB', // Modern blue
  primaryLight: '#3B82F6',
  primaryDark: '#1E40AF',
  secondary: '#10B981', // Modern emerald
  secondaryLight: '#34D399',
  accent: '#8B5CF6', // Modern purple
  error: '#EF4444',
  errorLight: '#FCA5A5',
  warning: '#F59E0B',
  success: '#10B981',
  background: '#F8FAFC',
  backgroundDark: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceVariant: '#F8FAFC',
  outline: '#E2E8F0',
  shadow: 'rgba(0, 0, 0, 0.08)',
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    tertiary: '#64748B',
    disabled: '#94A3B8',
    onPrimary: '#FFFFFF',
    onSurface: '#0F172A',
  },
};

export const TYPOGRAPHY = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
};

export const BORDER_RADIUS = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
};

export const SHADOWS = {
  sm: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 5,
  },
};