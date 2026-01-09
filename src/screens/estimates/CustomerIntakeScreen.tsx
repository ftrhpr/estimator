import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform, 
  Alert,
  StatusBar,
  Dimensions,
  TouchableOpacity 
} from 'react-native';
import { 
  Appbar, 
  TextInput, 
  Button, 
  Text, 
  Card, 
  Portal, 
  Modal, 
  Divider, 
  IconButton,
  ProgressBar
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CustomerIntakeFormData, IntakeResult, Vehicle } from '../../types';
import { CustomerService } from '../../services/customerService';
import { VehicleService } from '../../services/vehicleService';
import { VINScanner } from '../../components/common/VINScanner';
import { validatePhone, formatPhone } from '../../utils/helpers';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '../../config/constants';

const { width } = Dimensions.get('window');

interface CustomerIntakeScreenProps {
  onComplete: (result: IntakeResult) => void;
  onCancel: () => void;
}

export const CustomerIntakeScreen: React.FC<CustomerIntakeScreenProps> = ({
  onComplete,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  
  const [formData, setFormData] = useState<CustomerIntakeFormData>({
    customerName: '',
    phoneNumber: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    vin: '',
  });

  const [errors, setErrors] = useState<Partial<CustomerIntakeFormData>>({});
  const [loading, setLoading] = useState(false);
  const [showVINScanner, setShowVINScanner] = useState(false);

  const currentYear = new Date().getFullYear();

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<CustomerIntakeFormData> = {};

    switch (step) {
      case 1: // Customer Information
        if (!formData.customerName.trim()) {
          newErrors.customerName = 'Customer name is required';
        }
        if (!formData.phoneNumber.trim()) {
          newErrors.phoneNumber = 'Phone number is required';
        } else if (!validatePhone(formData.phoneNumber)) {
          newErrors.phoneNumber = 'Please enter a valid 10-digit phone number';
        }
        break;
        
      case 2: // Vehicle Information
        if (!formData.vehicleMake.trim()) {
          newErrors.vehicleMake = 'Vehicle make is required';
        }
        if (!formData.vehicleModel.trim()) {
          newErrors.vehicleModel = 'Vehicle model is required';
        }
        if (!formData.vehicleYear.trim()) {
          newErrors.vehicleYear = 'Vehicle year is required';
        } else {
          const year = parseInt(formData.vehicleYear);
          if (isNaN(year) || year < 1900 || year > currentYear + 1) {
            newErrors.vehicleYear = `Please enter a valid year between 1900 and ${currentYear + 1}`;
          }
        }
        break;
        
      case 3: // VIN (Optional)
        if (formData.vin.trim() && !VehicleService.validateVIN(formData.vin)) {
          newErrors.vin = 'VIN must be exactly 17 characters and cannot contain I, O, or Q';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateField = (field: keyof CustomerIntakeFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }

    // Auto-format phone number
    if (field === 'phoneNumber') {
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length <= 10) {
        setFormData(prev => ({ ...prev, [field]: cleaned }));
      }
    }

    // Auto-format VIN
    if (field === 'vin') {
      const formatted = VehicleService.formatVIN(value);
      if (formatted.length <= 17) {
        setFormData(prev => ({ ...prev, [field]: formatted }));
      }
    }

    // Auto-format year
    if (field === 'vehicleYear') {
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length <= 4) {
        setFormData(prev => ({ ...prev, [field]: cleaned }));
      }
    }
  };

  const handleVINScanned = (scannedVIN: string) => {
    updateField('vin', scannedVIN);
    setShowVINScanner(false);
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      // Parse customer name (assume it's "First Last" format)
      const nameParts = formData.customerName.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || firstName;

      // Create customer
      const customerData = {
        firstName,
        lastName,
        phone: formData.phoneNumber,
        email: '', // Optional for now
      };

      const customerId = await CustomerService.createCustomer(customerData);

      // Create vehicle
      const vehicleData: Omit<Vehicle, 'id'> = {
        customerId,
        make: formData.vehicleMake.trim(),
        model: formData.vehicleModel.trim(),
        year: parseInt(formData.vehicleYear),
        color: '', // Will be filled later
        licensePlate: '', // Will be filled later
      };

      // Only add VIN if it's not empty
      if (formData.vin && formData.vin.trim()) {
        vehicleData.vin = formData.vin.trim();
      }

      const vehicleId = await VehicleService.createVehicle(vehicleData);

      // Get the created records for return
      const customer = await CustomerService.getCustomer(customerId);
      const vehicle = await VehicleService.getVehicle(vehicleId);

      if (customer && vehicle) {
        const result: IntakeResult = {
          customerId,
          vehicleId,
          customer,
          vehicle,
        };

        onComplete(result);
      } else {
        throw new Error('Failed to retrieve created records');
      }
    } catch (error) {
      console.error('Error creating customer/vehicle:', error);
      Alert.alert(
        'Error',
        'Failed to save customer and vehicle information. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((step) => (
        <View key={step} style={styles.stepItem}>
          <View style={[
            styles.stepCircle, 
            currentStep >= step ? styles.stepCircleActive : styles.stepCircleInactive
          ]}>
            {currentStep > step ? (
              <MaterialCommunityIcons name="check" size={16} color={COLORS.text.onPrimary} />
            ) : (
              <Text style={[
                styles.stepNumber, 
                currentStep >= step ? styles.stepNumberActive : styles.stepNumberInactive
              ]}>
                {step}
              </Text>
            )}
          </View>
          {step < 3 && (
            <View style={[
              styles.stepLine, 
              currentStep > step ? styles.stepLineActive : styles.stepLineInactive
            ]} />
          )}
        </View>
      ))}
    </View>
  );

  const renderCustomerStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <MaterialCommunityIcons name="account-outline" size={24} color={COLORS.primary} />
        <Text style={styles.stepTitle}>Customer Information</Text>
      </View>
      
      <TextInput
        label="Customer Name *"
        value={formData.customerName}
        onChangeText={(value) => updateField('customerName', value)}
        error={!!errors.customerName}
        style={styles.input}
        mode="outlined"
        outlineColor={COLORS.outline}
        activeOutlineColor={COLORS.primary}
        left={<TextInput.Icon icon="account" color={COLORS.text.tertiary} />}
      />
      {errors.customerName && <Text style={styles.errorText}>{errors.customerName}</Text>}

      <TextInput
        label="Phone Number *"
        value={formatPhone(formData.phoneNumber)}
        onChangeText={(value) => updateField('phoneNumber', value.replace(/\D/g, ''))}
        error={!!errors.phoneNumber}
        style={styles.input}
        mode="outlined"
        keyboardType="numeric"
        placeholder="(555) 123-4567"
        maxLength={14}
        outlineColor={COLORS.outline}
        activeOutlineColor={COLORS.primary}
        left={<TextInput.Icon icon="phone" color={COLORS.text.tertiary} />}
      />
      {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
    </View>
  );

  const renderVehicleStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <MaterialCommunityIcons name="car-outline" size={24} color={COLORS.primary} />
        <Text style={styles.stepTitle}>Vehicle Information</Text>
      </View>
      
      <TextInput
        label="Vehicle Make *"
        value={formData.vehicleMake}
        onChangeText={(value) => updateField('vehicleMake', value)}
        error={!!errors.vehicleMake}
        style={styles.input}
        mode="outlined"
        placeholder="e.g., Toyota, Honda, Ford"
        outlineColor={COLORS.outline}
        activeOutlineColor={COLORS.primary}
        left={<TextInput.Icon icon="car" color={COLORS.text.tertiary} />}
      />
      {errors.vehicleMake && <Text style={styles.errorText}>{errors.vehicleMake}</Text>}

      <TextInput
        label="Vehicle Model *"
        value={formData.vehicleModel}
        onChangeText={(value) => updateField('vehicleModel', value)}
        error={!!errors.vehicleModel}
        style={styles.input}
        mode="outlined"
        placeholder="e.g., Camry, Civic, F-150"
        outlineColor={COLORS.outline}
        activeOutlineColor={COLORS.primary}
        left={<TextInput.Icon icon="car-sports" color={COLORS.text.tertiary} />}
      />
      {errors.vehicleModel && <Text style={styles.errorText}>{errors.vehicleModel}</Text>}

      <TextInput
        label="Vehicle Year *"
        value={formData.vehicleYear}
        onChangeText={(value) => updateField('vehicleYear', value)}
        error={!!errors.vehicleYear}
        style={styles.input}
        mode="outlined"
        keyboardType="numeric"
        placeholder={currentYear.toString()}
        maxLength={4}
        outlineColor={COLORS.outline}
        activeOutlineColor={COLORS.primary}
        left={<TextInput.Icon icon="calendar" color={COLORS.text.tertiary} />}
      />
      {errors.vehicleYear && <Text style={styles.errorText}>{errors.vehicleYear}</Text>}
    </View>
  );

  const renderVINStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <MaterialCommunityIcons name="barcode-scan" size={24} color={COLORS.primary} />
        <Text style={styles.stepTitle}>VIN (Optional)</Text>
      </View>
      
      <Text style={styles.stepDescription}>
        The VIN helps us provide more accurate estimates and service recommendations.
      </Text>
      
      <TextInput
        label="Vehicle Identification Number"
        value={formData.vin}
        onChangeText={(value) => updateField('vin', value)}
        error={!!errors.vin}
        style={styles.input}
        mode="outlined"
        placeholder="17-character VIN"
        maxLength={17}
        autoCapitalize="characters"
        outlineColor={COLORS.outline}
        activeOutlineColor={COLORS.primary}
        left={<TextInput.Icon icon="barcode" color={COLORS.text.tertiary} />}
        right={
          <TextInput.Icon 
            icon="barcode-scan" 
            onPress={() => setShowVINScanner(true)}
            iconColor={COLORS.primary}
          />
        }
      />
      {errors.vin && <Text style={styles.errorText}>{errors.vin}</Text>}
      
      <Button
        mode="outlined"
        onPress={() => setShowVINScanner(true)}
        style={styles.scanButton}
        icon="barcode-scan"
        textColor={COLORS.primary}
      >
        Scan VIN Barcode
      </Button>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      
      {/* Modern Header */}
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryLight]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={onCancel} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text.onPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>New Estimate</Text>
            <Text style={styles.headerSubtitle}>Step {currentStep} of {totalSteps}</Text>
          </View>
        </View>
        <ProgressBar 
          progress={currentStep / totalSteps} 
          color={COLORS.text.onPrimary}
          style={styles.progressBar}
        />
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderStepIndicator()}
        
        <View style={styles.formContainer}>
          {currentStep === 1 && renderCustomerStep()}
          {currentStep === 2 && renderVehicleStep()}
          {currentStep === 3 && renderVINStep()}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        {currentStep > 1 && (
          <Button
            mode="outlined"
            onPress={handleBack}
            style={[styles.actionButton, styles.backActionButton]}
            disabled={loading}
            textColor={COLORS.primary}
          >
            Back
          </Button>
        )}
        
        <Button
          mode="contained"
          onPress={handleNext}
          style={[styles.actionButton, styles.nextActionButton]}
          loading={loading}
          disabled={loading}
          buttonColor={COLORS.primary}
        >
          {currentStep === totalSteps ? 'Complete' : 'Next'}
        </Button>
      </View>

      {/* VIN Scanner Modal */}
      <Portal>
        <Modal
          visible={showVINScanner}
          onDismiss={() => setShowVINScanner(false)}
          contentContainerStyle={styles.modal}
        >
          <VINScanner
            onVINScanned={handleVINScanned}
            onClose={() => setShowVINScanner(false)}
          />
        </Modal>
      </Portal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: StatusBar.currentHeight || 44,
    paddingBottom: SPACING.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginRight: SPACING.md,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: '600',
    color: COLORS.text.onPrimary,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.onPrimary,
    opacity: 0.9,
    marginTop: 2,
  },
  progressBar: {
    marginHorizontal: SPACING.lg,
    height: 4,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  content: {
    flex: 1,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: COLORS.primary,
  },
  stepCircleInactive: {
    backgroundColor: COLORS.outline,
  },
  stepNumber: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
  },
  stepNumberActive: {
    color: COLORS.text.onPrimary,
  },
  stepNumberInactive: {
    color: COLORS.text.tertiary,
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: SPACING.xs,
  },
  stepLineActive: {
    backgroundColor: COLORS.primary,
  },
  stepLineInactive: {
    backgroundColor: COLORS.outline,
  },
  formContainer: {
    paddingHorizontal: SPACING.lg,
  },
  stepContent: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    ...SHADOWS.md,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  stepTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginLeft: SPACING.md,
  },
  stepDescription: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.base,
    marginBottom: SPACING.lg,
  },
  input: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  errorText: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.md,
    marginLeft: SPACING.md,
  },
  scanButton: {
    marginTop: SPACING.md,
    borderColor: COLORS.primary,
  },
  actionContainer: {
    flexDirection: 'row',
    padding: SPACING.lg,
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  actionButton: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
  },
  backActionButton: {
    borderColor: COLORS.primary,
  },
  nextActionButton: {
    backgroundColor: COLORS.primary,
  },
  modal: {
    flex: 1,
    margin: 0,
  },
});