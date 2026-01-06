import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity } from 'react-native';
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
        <Text style={styles.title}>Auto Body Estimator</Text>
        
        <View style={styles.card}>
          <Text style={styles.cardTitle}>New Estimate</Text>
          <Text style={styles.cardText}>
            Create a new estimate for vehicle damage assessment, including customer intake, photo documentation, and invoice generation.
          </Text>
          <TouchableOpacity 
            style={styles.button}
            onPress={handleNewEstimate}
          >
            <Text style={styles.buttonText}>Start New Estimate</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Service Management</Text>
          <Text style={styles.cardText}>
            Manage your repair services, add new services, edit pricing, and maintain your service catalog.
          </Text>
          <TouchableOpacity 
            style={[styles.button, styles.outlinedButton]}
            onPress={handleServiceSettings}
          >
            <Text style={[styles.buttonText, styles.outlinedButtonText]}>Manage Services</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Features</Text>
          <Text style={styles.cardText}>
            • Customer and vehicle intake with VIN scanning{'\n'}
            • Photo-based damage assessment{'\n'}
            • Service management with Georgian/English support{'\n'}
            • Professional PDF invoice generation{'\n'}
            • Firebase cloud storage and database
          </Text>
        </View>
      </ScrollView>
      
      <TouchableOpacity
        style={styles.fab}
        onPress={handleNewEstimate}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
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
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  cardText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  outlinedButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1976d2',
  },
  outlinedButtonText: {
    color: '#1976d2',
  },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    right: 16,
    bottom: 16,
    backgroundColor: '#1976d2',
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  fabText: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
  },
});     const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
      
      if (apiKey && projectId) {
        setConfigStatus(`✅ Firebase config loaded\nProject: ${projectId}\nAPI Key: ${apiKey.slice(0, 10)}...`);
      } else {
        setConfigStatus('❌ Firebase config missing');
      }
    } catch (error) {
      setConfigStatus(`❌ Error: ${error.message}`);
    }
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Auto Body Estimator</Text>
      <Text style={styles.subtitle}>Welcome! The app is working.</Text>
      <Text style={styles.configText}>{configStatus}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#1976d2',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  configText: {
    fontSize: 12,
    textAlign: 'center',
    color: '#888',
    fontFamily: 'monospace',
  },
});
