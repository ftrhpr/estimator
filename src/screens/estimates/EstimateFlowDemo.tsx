import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button, Text, Card } from 'react-native-paper';
import { CustomerIntakeScreen } from './CustomerIntakeScreen';
import { VisualEstimatorScreen } from './VisualEstimatorScreen';
import { ReviewEstimateScreen } from './ReviewEstimateScreen';
import { IntakeResult, VisualEstimate, EstimateReviewData } from '../../types';
import { EstimateService } from '../../services/estimateService';
import { COLORS } from '../../config/constants';

type FlowStep = 'start' | 'intake' | 'visual-estimator' | 'review' | 'complete';

export const EstimateFlowDemo: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<FlowStep>('start');
  const [intakeResult, setIntakeResult] = useState<IntakeResult | null>(null);
  const [visualEstimates, setVisualEstimates] = useState<VisualEstimate[]>([]);
  const [reviewData, setReviewData] = useState<EstimateReviewData | null>(null);

  const handleIntakeComplete = (result: IntakeResult) => {
    setIntakeResult(result);
    setCurrentStep('visual-estimator');
  };

  const handleIntakeCancel = () => {
    setCurrentStep('start');
  };

  const handleVisualEstimateComplete = async (estimates: VisualEstimate[]) => {
    if (!intakeResult) return;
    
    try {
      setVisualEstimates(estimates);
      
      // Convert visual estimates to review data
      const reviewData = await EstimateService.convertVisualEstimatesToReview(
        intakeResult.customer,
        intakeResult.vehicle,
        estimates
      );
      
      // Convert to Georgian Lari (you can adjust exchange rate as needed)
      const reviewDataInGEL = EstimateService.convertToGEL(reviewData, 2.65);
      
      setReviewData(reviewDataInGEL);
      setCurrentStep('review');
    } catch (error) {
      console.error('Error processing estimates:', error);
      Alert.alert('Error', 'Failed to process estimates. Please try again.');
    }
  };

  const handleVisualEstimateBack = () => {
    setCurrentStep('intake');
  };

  const handleReviewBack = () => {
    setCurrentStep('visual-estimator');
  };

  const handleReviewComplete = (data: EstimateReviewData) => {
    setReviewData(data);
    setCurrentStep('complete');
    
    Alert.alert(
      'Estimate Complete!',
      `Final estimate generated with ${data.lineItems.length} line items totaling ${data.total.toFixed(2)} ₾ (GEL).`,
      [
        {
          text: 'View Summary',
          onPress: () => {
            const summary = EstimateService.getEstimateSummary(data);
            console.log('Estimate Summary:', summary);
          },
        },
        {
          text: 'Start New',
          onPress: () => {
            setCurrentStep('start');
            resetFlow();
          },
        },
      ]
    );
  };

  const startNewEstimate = () => {
    setCurrentStep('intake');
    resetFlow();
  };

  const resetFlow = () => {
    setIntakeResult(null);
    setVisualEstimates([]);
    setReviewData(null);
  };

  const renderStartScreen = () => (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>
            Auto Body Estimate Flow
          </Text>
          
          <Text variant="bodyLarge" style={styles.description}>
            Complete estimate process with customer intake, vehicle details, and visual damage assessment.
          </Text>

          {intakeResult && (
            <View style={styles.resultContainer}>
              <Text variant="titleMedium" style={styles.resultTitle}>
                Last Completed:
              </Text>
              <Text variant="bodyMedium">
                Customer: {intakeResult.customer.firstName} {intakeResult.customer.lastName}
              </Text>
              <Text variant="bodyMedium">
                Vehicle: {intakeResult.vehicle.year} {intakeResult.vehicle.make} {intakeResult.vehicle.model}
              </Text>
              {visualEstimates.length > 0 && (
                <Text variant="bodyMedium">
                  Visual Estimates: {visualEstimates.length} photo(s)
                </Text>
              )}
              {reviewData && (
                <Text variant="bodyMedium">
                  Total Amount: {reviewData.total.toFixed(2)} ₾ (GEL)
                </Text>
              )}
            </View>
          )}

          <Button
            mode="contained"
            onPress={startNewEstimate}
            style={styles.button}
          >
            Start New Estimate
          </Button>
        </Card.Content>
      </Card>
    </View>
  );

  const renderCompleteScreen = () => (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>
            Estimate Complete! ✅
          </Text>
          
          <Text variant="bodyLarge" style={styles.description}>
            Your estimate has been saved with photos uploaded to Firebase Storage.
          </Text>

          {intakeResult && (
            <View style={styles.resultContainer}>
              <Text variant="titleMedium" style={styles.resultTitle}>
                Estimate Summary:
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
              <Text variant="bodyMedium">
                Photos: {visualEstimates.length} damage photo(s)
              </Text>
              
              {reviewData && (
                <>
                  <Text variant="bodyMedium">
                    Services: {reviewData.lineItems.length} items
                  </Text>
                  <Text variant="bodyMedium" style={styles.totalAmount}>
                    Total: {reviewData.total.toFixed(2)} ₾ (GEL)
                  </Text>
                </>
              )}
              
              {visualEstimates.map((estimate, index) => (
                <View key={estimate.id} style={styles.estimateItem}>
                  <Text variant="bodySmall" style={styles.estimateDetails}>
                    {index + 1}. {estimate.damageZone} - {(estimate.cost * 2.65).toFixed(2)} ₾
                  </Text>
                  <Text variant="bodySmall" style={styles.repairTypes}>
                    Repairs: {estimate.repairType.join(', ')}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.buttonContainer}>
            <Button
              mode="outlined"
              onPress={() => setCurrentStep('start')}
              style={styles.button}
            >
              Back to Home
            </Button>
            <Button
              mode="contained"
              onPress={startNewEstimate}
              style={styles.button}
            >
              New Estimate
            </Button>
          </View>
        </Card.Content>
      </Card>
    </View>
  );

  // Render based on current step
  switch (currentStep) {
    case 'intake':
      return (
        <CustomerIntakeScreen
          onComplete={handleIntakeComplete}
          onCancel={handleIntakeCancel}
        />
      );
    
    case 'visual-estimator':
      if (!intakeResult) {
        setCurrentStep('start');
        return null;
      }
      return (
        <VisualEstimatorScreen
          intakeData={intakeResult}
          onComplete={handleVisualEstimateComplete}
          onBack={handleVisualEstimateBack}
        />
      );
    
    case 'review':
      if (!reviewData) {
        setCurrentStep('visual-estimator');
        return null;
      }
      return (
        <ReviewEstimateScreen
          estimateData={reviewData}
          onBack={handleReviewBack}
          onSave={handleReviewComplete}
        />
      );
    
    case 'complete':
      return renderCompleteScreen();
    
    default:
      return renderStartScreen();
  }
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
  estimateItem: {
    marginTop: 8,
    paddingLeft: 8,
  },
  estimateDetails: {
    color: COLORS.text.primary,
    fontWeight: '600',
  },
  repairTypes: {
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  totalAmount: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: COLORS.primary,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
});