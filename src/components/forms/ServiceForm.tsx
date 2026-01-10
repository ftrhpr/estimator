import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text, Card, SegmentedButtons } from 'react-native-paper';
import { Service, ServiceFormData } from '../../types';
import { SERVICE_CATEGORIES } from '../../config/services';
import { COLORS } from '../../config/constants';

interface ServiceFormProps {
  service?: Service;
  onSubmit: (data: ServiceFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ServiceForm: React.FC<ServiceFormProps> = ({
  service,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [formData, setFormData] = useState<ServiceFormData>({
    nameEn: service?.nameEn || '',
    nameKa: service?.nameKa || '',
    description: service?.description || '',
    basePrice: service?.basePrice?.toString() || '',
    category: service?.category || 'bodywork',
  });

  const [errors, setErrors] = useState<Partial<ServiceFormData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<ServiceFormData> = {};

    if (!formData.nameEn.trim()) {
      newErrors.nameEn = 'English name is required';
    }

    if (!formData.nameKa.trim()) {
      newErrors.nameKa = 'Georgian name is required';
    }

    const price = parseFloat(formData.basePrice);
    if (!formData.basePrice || isNaN(price) || price <= 0) {
      newErrors.basePrice = 'Valid base price is required';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const updateField = (field: keyof ServiceFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const categoryButtons = SERVICE_CATEGORIES.map(cat => ({
    value: cat.value,
    label: cat.labelKa,
  }));

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.formCard}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>
            {service ? 'Edit Service' : 'Add New Service'}
          </Text>

          <TextInput
            label="Service Name (English)"
            value={formData.nameEn}
            onChangeText={(value) => updateField('nameEn', value)}
            style={styles.input}
            error={!!errors.nameEn}
            disabled={loading}
          />
          {errors.nameEn && (
            <Text style={styles.errorText}>{errors.nameEn}</Text>
          )}

          <TextInput
            label="Service Name (Georgian / ქართული)"
            value={formData.nameKa}
            onChangeText={(value) => updateField('nameKa', value)}
            style={styles.input}
            error={!!errors.nameKa}
            disabled={loading}
          />
          {errors.nameKa && (
            <Text style={styles.errorText}>{errors.nameKa}</Text>
          )}

          <TextInput
            label="Description (Optional)"
            value={formData.description}
            onChangeText={(value) => updateField('description', value)}
            style={styles.input}
            multiline
            numberOfLines={3}
            disabled={loading}
            placeholder="Add optional description for this service"
          />

          <TextInput
            label="Base Price ($)"
            value={formData.basePrice}
            onChangeText={(value) => updateField('basePrice', value)}
            keyboardType="decimal-pad"
            style={styles.input}
            error={!!errors.basePrice}
            disabled={loading}
          />
          {errors.basePrice && (
            <Text style={styles.errorText}>{errors.basePrice}</Text>
          )}

          <Text variant="labelLarge" style={styles.sectionLabel}>
            Category
          </Text>
          <SegmentedButtons
            value={formData.category}
            onValueChange={(value) => updateField('category', value)}
            buttons={categoryButtons}
            style={styles.segmentedButtons}
          />
          {errors.category && (
            <Text style={styles.errorText}>{errors.category}</Text>
          )}

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
              style={styles.button}
              loading={loading}
              disabled={loading}
            >
              {service ? 'Update Service' : 'Create Service'}
            </Button>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  formCard: {
    margin: 16,
    elevation: 4,
  },
  title: {
    marginBottom: 24,
    textAlign: 'center',
    color: COLORS.text.primary,
  },
  input: {
    marginBottom: 8,
  },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 8,
    color: COLORS.text.primary,
  },
  segmentedButtons: {
    marginBottom: 8,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginBottom: 8,
    marginLeft: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 16,
  },
  button: {
    flex: 1,
  },
});