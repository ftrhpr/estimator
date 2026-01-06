import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';

export default function HomeScreen() {
  const [configStatus, setConfigStatus] = useState('Loading...');

  useEffect(() => {
    // Test Firebase config
    try {
      const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
      const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
      
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
