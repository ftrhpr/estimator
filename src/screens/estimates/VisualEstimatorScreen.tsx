import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image, FlatList } from 'react-native';
import { Appbar, FAB, Card, Text, Button, TextInput, Chip, Modal, Portal, ActivityIndicator } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { IntakeResult, PhotoAngle, VisualEstimate, EstimatePhoto } from '../../types';
import { StorageService } from '../../services/storageService';
import { VisualEstimateService } from '../../services/visualEstimateService';
import { PhotoAngleSelector } from '../../components/common/PhotoAngleSelector';
import { DEFAULT_SERVICES } from '../../config/services';
import { formatCurrency } from '../../utils/helpers';
import { COLORS } from '../../config/constants';

interface VisualEstimatorScreenProps {
  intakeData: IntakeResult;
  onComplete: (estimates: VisualEstimate[]) => void;
  onBack: () => void;
}

interface PhotoWithDetails {
  uri: string;
  angle?: PhotoAngle;
  damageZone?: string;
  cost?: number;
  repairTypes?: string[];
  uploading?: boolean;
  uploaded?: boolean;
  estimateId?: string;
}

export const VisualEstimatorScreen: React.FC<VisualEstimatorScreenProps> = ({
  intakeData,
  onComplete,
  onBack,
}) => {
  const [photos, setPhotos] = useState<PhotoWithDetails[]>([]);
  const [currentPhoto, setCurrentPhoto] = useState<PhotoWithDetails | null>(null);
  const [showAngleSelector, setShowAngleSelector] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form states for damage details
  const [damageZone, setDamageZone] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [selectedRepairTypes, setSelectedRepairTypes] = useState<string[]>([]);
  const [similarRepairs, setSimilarRepairs] = useState<VisualEstimate[]>([]);

  const availableRepairTypes = Object.values(DEFAULT_SERVICES).map(service => service.nameEn);

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'This app needs camera and photo library permissions to work properly.'
      );
    }
  };

  const handleTakePhoto = async () => {
    try {
      Alert.alert(
        'Add Photo',
        'Choose how you want to add a photo',
        [
          {
            text: 'Camera',
            onPress: async () => {
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                const newPhoto: PhotoWithDetails = {
                  uri: result.assets[0].uri,
                };
                
                setCurrentPhoto(newPhoto);
                setShowAngleSelector(true);
              }
            },
          },
          {
            text: 'Photo Library',
            onPress: async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
                allowsMultipleSelection: false,
              });

              if (!result.canceled && result.assets[0]) {
                const newPhoto: PhotoWithDetails = {
                  uri: result.assets[0].uri,
                };
                
                setCurrentPhoto(newPhoto);
                setShowAngleSelector(true);
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const handleAngleSelected = (angle: PhotoAngle) => {
    if (currentPhoto) {
      const updatedPhoto = { ...currentPhoto, angle };
      setCurrentPhoto(updatedPhoto);
      setShowAngleSelector(false);
      setShowDetailsModal(true);
    }
  };

  const handleDetailsSubmit = async () => {
    if (!currentPhoto || !currentPhoto.angle) return;

    if (!damageZone.trim()) {
      Alert.alert('Missing Information', 'Please specify the damage zone.');
      return;
    }

    if (!estimatedCost.trim() || isNaN(parseFloat(estimatedCost))) {
      Alert.alert('Missing Information', 'Please enter a valid estimated cost.');
      return;
    }

    if (selectedRepairTypes.length === 0) {
      Alert.alert('Missing Information', 'Please select at least one repair type.');
      return;
    }

    setLoading(true);

    try {
      // Upload photo to Firebase Storage
      const photoWithDetails: PhotoWithDetails = {
        ...currentPhoto,
        damageZone: damageZone.trim(),
        cost: parseFloat(estimatedCost),
        repairTypes: selectedRepairTypes,
        uploading: true,
      };

      // Add to photos list
      setPhotos(prev => [...prev, photoWithDetails]);
      
      // Upload image
      const imageURL = await StorageService.uploadEstimatePhoto(currentPhoto.uri);
      
      // Create visual estimate record
      const vehicleModel = `${intakeData.vehicle.make} ${intakeData.vehicle.model}`;
      const estimateId = await VisualEstimateService.createEstimateFromVehicle(
        intakeData.vehicle,
        damageZone.trim(),
        parseFloat(estimatedCost),
        imageURL,
        selectedRepairTypes,
        currentPhoto.angle
      );

      // Update photo record
      setPhotos(prev => 
        prev.map(photo => 
          photo.uri === currentPhoto.uri 
            ? { ...photo, uploading: false, uploaded: true, estimateId }
            : photo
        )
      );

      // Load similar repairs for reference
      await loadSimilarRepairs(vehicleModel, damageZone.trim());

      // Reset form
      resetForm();
      setShowDetailsModal(false);
      
      Alert.alert('Success', 'Photo and estimate details saved successfully!');
    } catch (error) {
      console.error('Error saving photo details:', error);
      Alert.alert('Error', 'Failed to save photo details. Please try again.');
      
      // Remove failed photo from list
      setPhotos(prev => prev.filter(photo => photo.uri !== currentPhoto.uri));
    } finally {
      setLoading(false);
    }
  };

  const loadSimilarRepairs = async (vehicleModel: string, damageZone: string) => {
    try {
      const repairs = await VisualEstimateService.findSimilarRepairs(vehicleModel, damageZone, 5);
      setSimilarRepairs(repairs);
    } catch (error) {
      console.error('Error loading similar repairs:', error);
    }
  };

  const resetForm = () => {
    setCurrentPhoto(null);
    setDamageZone('');
    setEstimatedCost('');
    setSelectedRepairTypes([]);
  };

  const handleFinishEstimate = async () => {
    if (photos.length === 0) {
      Alert.alert('No Photos', 'Please add at least one photo before finishing the estimate.');
      return;
    }

    const uploadedPhotos = photos.filter(photo => photo.uploaded);
    
    if (uploadedPhotos.length < photos.length) {
      Alert.alert('Upload in Progress', 'Please wait for all photos to finish uploading.');
      return;
    }

    try {
      setLoading(true);
      
      // Get all visual estimates for this session
      const estimates: VisualEstimate[] = [];
      
      for (const photo of uploadedPhotos) {
        if (photo.estimateId) {
          const estimate = await VisualEstimateService.getVisualEstimate(photo.estimateId);
          if (estimate) {
            estimates.push(estimate);
          }
        }
      }

      if (estimates.length === 0) {
        Alert.alert('Error', 'No estimates found. Please try again.');
        return;
      }

      onComplete(estimates);
    } catch (error) {
      console.error('Error completing estimate:', error);
      Alert.alert('Error', 'Failed to complete estimate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderPhoto = ({ item }: { item: PhotoWithDetails }) => (
    <Card style={styles.photoCard}>
      <View style={styles.photoContainer}>
        <Image source={{ uri: item.uri }} style={styles.photo} />
        
        {item.uploading && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator size="large" color="white" />
            <Text style={styles.uploadingText}>Uploading...</Text>
          </View>
        )}
        
        {item.uploaded && (
          <View style={styles.uploadedBadge}>
            <Text style={styles.uploadedText}>✓</Text>
          </View>
        )}
      </View>
      
      <Card.Content style={styles.photoDetails}>
        <Text variant="titleSmall">{item.angle}</Text>
        {item.damageZone && (
          <Text variant="bodySmall" style={styles.damageZone}>
            {item.damageZone}
          </Text>
        )}
        {item.cost && (
          <Text variant="bodySmall" style={styles.cost}>
            {formatCurrency(item.cost)}
          </Text>
        )}
      </Card.Content>
    </Card>
  );

  const renderRepairTypeChips = () => {
    return availableRepairTypes.map((type) => (
      <Chip
        key={type}
        selected={selectedRepairTypes.includes(type)}
        onPress={() => {
          if (selectedRepairTypes.includes(type)) {
            setSelectedRepairTypes(prev => prev.filter(t => t !== type));
          } else {
            setSelectedRepairTypes(prev => [...prev, type]);
          }
        }}
        style={styles.repairChip}
      >
        {type}
      </Chip>
    ));
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={onBack} />
        <Appbar.Content title="Visual Estimator" />
        {photos.length > 0 && (
          <Appbar.Action icon="check" onPress={handleFinishEstimate} />
        )}
      </Appbar.Header>

      <ScrollView style={styles.content}>
        <Card style={styles.vehicleCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.vehicleTitle}>
              {intakeData.vehicle.year} {intakeData.vehicle.make} {intakeData.vehicle.model}
            </Text>
            <Text variant="bodyMedium" style={styles.customerName}>
              {intakeData.customer.firstName} {intakeData.customer.lastName}
            </Text>
            {intakeData.vehicle.vin && (
              <Text variant="bodySmall" style={styles.vin}>
                VIN: {intakeData.vehicle.vin}
              </Text>
            )}
          </Card.Content>
        </Card>

        {photos.length > 0 && (
          <Card style={styles.photosCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Damage Photos ({photos.length})
              </Text>
              <FlatList
                data={photos}
                renderItem={renderPhoto}
                keyExtractor={(item, index) => `photo-${index}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.photosList}
              />
            </Card.Content>
          </Card>
        )}

        {similarRepairs.length > 0 && (
          <Card style={styles.similarCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Similar Repairs
              </Text>
              {similarRepairs.map((repair, index) => (
                <View key={repair.id} style={styles.similarRepair}>
                  <Text variant="bodyMedium">{repair.damageZone}</Text>
                  <Text variant="bodySmall" style={styles.similarCost}>
                    {formatCurrency(repair.cost)}
                  </Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      <FAB
        icon="camera"
        style={styles.fab}
        onPress={handleTakePhoto}
        label="Take Photo"
      />

      {/* Photo Angle Selector */}
      <PhotoAngleSelector
        visible={showAngleSelector}
        onSelect={handleAngleSelected}
        onCancel={() => {
          setShowAngleSelector(false);
          setCurrentPhoto(null);
        }}
      />

      {/* Photo Details Modal */}
      <Portal>
        <Modal
          visible={showDetailsModal}
          onDismiss={() => setShowDetailsModal(false)}
          contentContainerStyle={styles.detailsModal}
        >
          <Card>
            <Card.Content>
              <Text variant="headlineSmall" style={styles.modalTitle}>
                Damage Details
              </Text>

              {currentPhoto && (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: currentPhoto.uri }} style={styles.previewImage} />
                  <Text variant="bodyMedium" style={styles.previewAngle}>
                    Angle: {currentPhoto.angle}
                  </Text>
                </View>
              )}

              <TextInput
                label="Damage Zone *"
                value={damageZone}
                onChangeText={setDamageZone}
                style={styles.input}
                placeholder="e.g., Front Bumper, Driver Side Door"
              />

              <TextInput
                label="Estimated Cost ($) *"
                value={estimatedCost}
                onChangeText={setEstimatedCost}
                keyboardType="decimal-pad"
                style={styles.input}
                placeholder="150.00"
              />

              <Text variant="labelLarge" style={styles.repairTypesLabel}>
                Repair Types Required *
              </Text>
              <View style={styles.chipContainer}>
                {renderRepairTypeChips()}
              </View>

              <View style={styles.modalButtons}>
                <Button
                  mode="outlined"
                  onPress={() => setShowDetailsModal(false)}
                  style={styles.modalButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleDetailsSubmit}
                  style={styles.modalButton}
                  loading={loading}
                >
                  Save Photo
                </Button>
              </View>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>
    </View>
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
  vehicleCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  vehicleTitle: {
    fontWeight: 'bold',
    color: COLORS.text.primary,
  },
  customerName: {
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  vin: {
    color: COLORS.text.secondary,
    marginTop: 2,
    fontSize: 12,
  },
  photosCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  sectionTitle: {
    marginBottom: 12,
    color: COLORS.text.primary,
    fontWeight: '600',
  },
  photosList: {
    flexGrow: 0,
  },
  photoCard: {
    width: 200,
    marginRight: 12,
    elevation: 1,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  uploadingText: {
    color: 'white',
    marginTop: 8,
    fontSize: 12,
  },
  uploadedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: COLORS.success,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadedText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  photoDetails: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  damageZone: {
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  cost: {
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  similarCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  similarRepair: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  similarCost: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: COLORS.primary,
  },
  detailsModal: {
    margin: 20,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 16,
    color: COLORS.text.primary,
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  previewImage: {
    width: 120,
    height: 90,
    borderRadius: 8,
    marginBottom: 8,
  },
  previewAngle: {
    color: COLORS.text.secondary,
  },
  input: {
    marginBottom: 12,
  },
  repairTypesLabel: {
    marginBottom: 8,
    color: COLORS.text.primary,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  repairChip: {
    marginBottom: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
  },
});