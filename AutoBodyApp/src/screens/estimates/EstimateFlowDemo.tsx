import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button, Text, Card } from 'react-native-paper';
import { CustomerIntakeScreen } from './CustomerIntakeScreen';
import { IntakeResult } from '../../types';
import { COLORS } from '../../config/constants';

export const EstimateFlowDemo: React.FC = () => {
  const [showIntake, setShowIntake] = useState(false);
  const [intakeResult, setIntakeResult] = useState<IntakeResult | null>(null);

  const handleIntakeComplete = (result: IntakeResult) => {
    setIntakeResult(result);
    setShowIntake(false);
    
    Alert.alert(
      'Intake Complete!',
      `Customer: ${result.customer.firstName} ${result.customer.lastName}\nVehicle: ${result.vehicle.year} ${result.vehicle.make} ${result.vehicle.model}`,
      [
        {
          text: 'Continue to Estimate',
          onPress: () => {
            // Navigate to estimate creation screen
            console.log('Navigate to estimate creation with:', result);
          },
        },
      ]
    );
  };

  const handleIntakeCancel = () => {
    setShowIntake(false);
  };

  if (showIntake) {
    return (
      <CustomerIntakeScreen
        onComplete={handleIntakeComplete}
        onCancel={handleIntakeCancel}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>
            New Estimate Flow
          </Text>
          
          <Text variant="bodyLarge" style={styles.description}>
            Start the estimate process by collecting customer and vehicle information.
          </Text>

          {intakeResult && (
            <View style={styles.resultContainer}>
              <Text variant="titleMedium" style={styles.resultTitle}>
                Last Intake Result:
              </Text>
              <Text variant="bodyMedium">
                Customer: {intakeResult.customer.firstName} {intakeResult.customer.lastName}
              </Text>
              <Text variant="bodyMedium">
                Phone: {intakeResult.customer.phone}
              </Text>
              <Text variant="bodyMedium">
                Vehicle: {intakeResult.vehicle.year} {intakeResult.vehicle.make} {intakeResult.vehicle.model}
              </Text>
              {intakeResult.vehicle.vin && (
                <Text variant="bodyMedium">
                  VIN: {intakeResult.vehicle.vin}
                </Text>
              )}
            </View>
          )}

          <Button
            mode="contained"
            onPress={() => setShowIntake(true)}
            style={styles.button}
          >
            Start New Estimate
          </Button>
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    elevation: 4,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
    color: COLORS.text.primary,
  },
  description: {
    textAlign: 'center',
    marginBottom: 24,
    color: COLORS.text.secondary,
    lineHeight: 22,
  },
  resultContainer: {
    backgroundColor: COLORS.background,
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  resultTitle: {
    marginBottom: 8,
    color: COLORS.text.primary,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: COLORS.primary,
  },
});