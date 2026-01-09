import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  Surface,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function HomeScreen({ navigation }) {
  const handleNewInspection = () => {
    navigation.navigate('Camera');
  };

  const handleHistory = () => {
    Alert.alert('Coming Soon', 'History feature will be implemented soon!');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Hero Section */}
        <LinearGradient
          colors={['#2563EB', '#3B82F6']}
          style={styles.heroSection}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <MaterialCommunityIcons 
            name="car-wrench" 
            size={64} 
            color="white" 
            style={styles.heroIcon}
          />
          <Text style={styles.heroTitle}>Auto Body Estimator</Text>
          <Text style={styles.heroSubtitle}>
            Professional damage assessment and repair estimation
          </Text>
        </LinearGradient>

        {/* Main Action Cards */}
        <View style={styles.actionsContainer}>
          
          {/* New Inspection Card */}
          <Card style={[styles.actionCard, styles.primaryCard]}>
            <LinearGradient
              colors={['#2563EB', '#1d4ed8']}
              style={styles.cardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons 
                    name="camera-plus" 
                    size={48} 
                    color="white"
                  />
                  <Text style={styles.primaryCardTitle}>New Inspection</Text>
                </View>
                
                <Text style={styles.primaryCardDescription}>
                  Start a new vehicle damage assessment with our photo-first workflow.
                  Capture photos and add damage pins for accurate estimates.
                </Text>

                <Button
                  mode="contained"
                  onPress={handleNewInspection}
                  style={styles.primaryButton}
                  buttonColor="rgba(255,255,255,0.2)"
                  textColor="white"
                  icon="arrow-right"
                >
                  Start New Inspection
                </Button>
              </Card.Content>
            </LinearGradient>
          </Card>

          {/* History Card */}
          <Card style={[styles.actionCard, styles.secondaryCard]}>
            <Surface style={styles.cardSurface}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons 
                    name="history" 
                    size={48} 
                    color="#10B981"
                  />
                  <Text style={styles.secondaryCardTitle}>Inspection History</Text>
                </View>
                
                <Text style={styles.secondaryCardDescription}>
                  View and manage previous vehicle inspections, estimates, 
                  and generate reports for your records.
                </Text>

                <Button
                  mode="outlined"
                  onPress={handleHistory}
                  style={styles.secondaryButton}
                  textColor="#10B981"
                  icon="folder-open"
                >
                  View History
                </Button>
              </Card.Content>
            </Surface>
          </Card>

        </View>

        {/* Feature Highlights */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Key Features</Text>
          
          <View style={styles.featureRow}>
            <View style={styles.featureItem}>
              <MaterialCommunityIcons name="camera" size={32} color="#2563EB" />
              <Text style={styles.featureLabel}>Photo Capture</Text>
            </View>
            
            <View style={styles.featureItem}>
              <MaterialCommunityIcons name="map-marker" size={32} color="#2563EB" />
              <Text style={styles.featureLabel}>Damage Tagging</Text>
            </View>
            
            <View style={styles.featureItem}>
              <MaterialCommunityIcons name="file-pdf-box" size={32} color="#2563EB" />
              <Text style={styles.featureLabel}>PDF Reports</Text>
            </View>
          </View>
        </View>
        
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroSection: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  heroIcon: {
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  actionsContainer: {
    padding: 16,
    gap: 16,
  },
  actionCard: {
    elevation: 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  primaryCard: {
    marginBottom: 8,
  },
  secondaryCard: {
    marginBottom: 8,
  },
  cardGradient: {
    flex: 1,
  },
  cardSurface: {
    flex: 1,
    backgroundColor: 'white',
  },
  cardContent: {
    padding: 20,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryCardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 12,
    textAlign: 'center',
  },
  secondaryCardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 12,
    textAlign: 'center',
  },
  primaryCardDescription: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  secondaryCardDescription: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  primaryButton: {
    paddingVertical: 8,
    borderRadius: 8,
  },
  secondaryButton: {
    paddingVertical: 8,
    borderRadius: 8,
    borderColor: '#10B981',
  },
  featuresContainer: {
    padding: 16,
    marginTop: 8,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
  },
  featureLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
});