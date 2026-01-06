import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Title, Paragraph, Button, FAB } from 'react-native-paper';
import { router } from 'expo-router';

export default function HomeScreen() {
  const handleNewEstimate = () => {
    // Navigate to EstimateFlowDemo
    router.push('/estimates/EstimateFlowDemo');
  };

  const handleServiceSettings = () => {
    // Navigate to ServiceSettings
    router.push('/services/ServiceSettingsScreen');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Title style={styles.title}>Auto Body Estimator</Title>
        
        <Card style={styles.card}>
          <Card.Content>
            <Title>New Estimate</Title>
            <Paragraph>
              Create a new estimate for vehicle damage assessment, including customer intake, photo documentation, and invoice generation.
            </Paragraph>
            <Button 
              mode="contained" 
              onPress={handleNewEstimate}
              style={styles.button}
            >
              Start New Estimate
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Title>Service Management</Title>
            <Paragraph>
              Manage your repair services, add new services, edit pricing, and maintain your service catalog.
            </Paragraph>
            <Button 
              mode="outlined" 
              onPress={handleServiceSettings}
              style={styles.button}
            >
              Manage Services
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Title>Features</Title>
            <Paragraph>
              • Customer and vehicle intake with VIN scanning{'\n'}
              • Photo-based damage assessment{'\n'}
              • Service management with Georgian/English support{'\n'}
              • Professional PDF invoice generation{'\n'}
              • Firebase cloud storage and database
            </Paragraph>
          </Card.Content>
        </Card>
      </ScrollView>
      
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleNewEstimate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80, // Space for FAB
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#1976d2',
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  button: {
    marginTop: 12,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#1976d2',
  },
});
