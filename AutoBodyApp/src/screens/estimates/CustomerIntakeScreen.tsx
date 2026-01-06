import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Appbar, TextInput, Button, Text, Card, Portal, Modal, Divider, IconButton } from 'react-native-paper';
import { CustomerIntakeFormData, IntakeResult } from '../../types';
import { CustomerService } from '../../services/customerService';
import { VehicleService } from '../../services/vehicleService';
import { VINScanner } from '../../components/common/VINScanner';
import { validatePhone, formatPhone } from '../../utils/helpers';
import { COLORS } from '../../config/constants';

interface CustomerIntakeScreenProps {
  onComplete: (result: IntakeResult) => void;
  onCancel: () => void;
}

export const CustomerIntakeScreen: React.FC<CustomerIntakeScreenProps> = ({
  onComplete,
  onCancel,
}) => {
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

  const validateForm = (): boolean => {
    const newErrors: Partial<CustomerIntakeFormData> = {};

    // Customer validation
    if (!formData.customerName.trim()) {
      newErrors.customerName = 'Customer name is required';
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!validatePhone(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid 10-digit phone number';
    }

    // Vehicle validation
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

    // VIN validation (optional but if provided, must be valid)
    if (formData.vin.trim() && !VehicleService.validateVIN(formData.vin)) {
      newErrors.vin = 'VIN must be exactly 17 characters and cannot contain I, O, or Q';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
    if (!validateForm()) {
      Alert.alert('Form Errors', 'Please fix the errors above and try again.');
      return;
    }

    setLoading(true);

    try {
      // Parse customer name (assume it's "First Last" format)
      const nameParts = formData.customerName.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || firstName; // Use first name as last if no space

      // Create customer
      const customerData = {
        firstName,
        lastName,
        phone: formData.phoneNumber,
        email: '', // Optional for now
      };

      const customerId = await CustomerService.createCustomer(customerData);

      // Create vehicle
      const vehicleData = {
        customerId,
        make: formData.vehicleMake.trim(),
        model: formData.vehicleModel.trim(),
        year: parseInt(formData.vehicleYear),
        color: '', // Will be filled later
        vin: formData.vin.trim() || undefined,
        licensePlate: '', // Will be filled later
        mileage: undefined,
      };

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
        'Failed to save customer and vehicle information. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={onCancel} />
        <Appbar.Content title="New Estimate - Customer Info" />
      </Appbar.Header>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Customer Information */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Customer Information
            </Text>

            <TextInput
              label="Full Name *"
              value={formData.customerName}
              onChangeText={(value) => updateField('customerName', value)}
              style={styles.input}
              error={!!errors.customerName}
              disabled={loading}
              autoCapitalize="words"
            />
            {errors.customerName && (
              <Text style={styles.errorText}>{errors.customerName}</Text>
            )}

            <TextInput
              label="Phone Number *"
              value={formData.phoneNumber}
              onChangeText={(value) => updateField('phoneNumber', value)}
              keyboardType="phone-pad"
              style={styles.input}
              error={!!errors.phoneNumber}
              disabled={loading}
              placeholder="1234567890"
              right={
                <TextInput.Affix 
                  text={formData.phoneNumber ? formatPhone(formData.phoneNumber) : ''} 
                />
              }
            />
            {errors.phoneNumber && (
              <Text style={styles.errorText}>{errors.phoneNumber}</Text>
            )}
          </Card.Content>
        </Card>

        {/* Vehicle Information */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Vehicle Information
            </Text>

            <View style={styles.row}>
              <TextInput
                label="Make *"
                value={formData.vehicleMake}
                onChangeText={(value) => updateField('vehicleMake', value)}
                style={[styles.input, styles.halfInput]}
                error={!!errors.vehicleMake}
                disabled={loading}
                autoCapitalize="words"
                placeholder="Toyota, Ford, etc."
              />

              <TextInput
                label="Model *"
                value={formData.vehicleModel}
                onChangeText={(value) => updateField('vehicleModel', value)}
                style={[styles.input, styles.halfInput]}
                error={!!errors.vehicleModel}
                disabled={loading}
                autoCapitalize="words"
                placeholder="Camry, F-150, etc."
              />
            </View>

            <View style={styles.errorRow}>
              {errors.vehicleMake && (
                <Text style={[styles.errorText, styles.halfError]}>{errors.vehicleMake}</Text>
              )}
              {errors.vehicleModel && (
                <Text style={[styles.errorText, styles.halfError]}>{errors.vehicleModel}</Text>
              )}
            </View>

            <TextInput
              label="Year *"
              value={formData.vehicleYear}
              onChangeText={(value) => updateField('vehicleYear', value)}
              keyboardType="numeric"
              style={styles.input}
              error={!!errors.vehicleYear}
              disabled={loading}
              placeholder={`e.g., ${currentYear}`}
              maxLength={4}
            />
            {errors.vehicleYear && (
              <Text style={styles.errorText}>{errors.vehicleYear}</Text>
            )}

            <Divider style={styles.divider} />

            <Text variant="labelLarge" style={styles.vinLabel}>
              VIN (Optional)
            </Text>
            <Text variant="bodySmall" style={styles.vinDescription}>
              Vehicle Identification Number helps ensure accurate parts and service information
            </Text>

            <View style={styles.vinContainer}>
              <TextInput
                label="VIN"
                value={formData.vin}
                onChangeText={(value) => updateField('vin', value)}
                style={[styles.input, styles.vinInput]}
                error={!!errors.vin}
                disabled={loading}
                autoCapitalize="characters"
                placeholder="17-character VIN"
                maxLength={17}
              />
              
              <IconButton
                icon="barcode-scan"
                mode="contained"
                onPress={() => setShowVINScanner(true)}
                style={styles.scanButton}
                iconColor="white"
                disabled={loading}
              />
            </View>

            {errors.vin && (
              <Text style={styles.errorText}>{errors.vin}</Text>
            )}
            
            {formData.vin && VehicleService.validateVIN(formData.vin) && (
              <Text style={styles.successText}>✓ Valid VIN format</Text>
            )}
          </Card.Content>
        </Card>

        <View style={styles.buttonContainer}>
          <Button
            mode="outlined"
            onPress={onCancel}
            style={styles.button}
            disabled={loading}
          >
            Cancel
          </Button>
          
          <Button
            mode="contained"
            onPress={handleSubmit}
            style={[styles.button, styles.primaryButton]}
            loading={loading}
            disabled={loading}
          >
            Next: Create Estimate
          </Button>
        </View>
      </ScrollView>

      {/* VIN Scanner Modal */}
      <Portal>
        <Modal
          visible={showVINScanner}
          onDismiss={() => setShowVINScanner(false)}
          contentContainerStyle={styles.scannerModal}
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
  content: {
    flex: 1,
  },
  card: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  sectionTitle: {
    marginBottom: 16,
    color: COLORS.text.primary,
    fontWeight: 'bold',
  },
  input: {
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  halfInput: {
    flex: 1,
  },
  errorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  halfError: {
    flex: 1,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginBottom: 8,
    marginLeft: 16,
  },
  successText: {
    color: COLORS.success,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 16,
  },
  divider: {
    marginVertical: 16,
  },
  vinLabel: {
    marginBottom: 4,
    color: COLORS.text.primary,
  },
  vinDescription: {
    marginBottom: 12,
    color: COLORS.text.secondary,
    lineHeight: 18,
  },
  vinContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vinInput: {
    flex: 1,
    marginBottom: 0,
  },
  scanButton: {
    backgroundColor: COLORS.primary,
    marginTop: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    margin: 16,
    marginTop: 24,
    gap: 16,
  },
  button: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  scannerModal: {
    flex: 1,
  },
});