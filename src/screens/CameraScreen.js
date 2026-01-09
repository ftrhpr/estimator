import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  Button,
  ActivityIndicator,
  Portal,
  Modal,
} from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');
const THUMBNAIL_SIZE = 80;

// Ghost Guide Labels
const PHOTO_LABELS = ['Front', 'Right Side', 'Rear', 'Left Side', 'Damage Detail'];
const DAMAGE_DETAIL_INDEX = 4; // Index for "Damage Detail"

export default function CameraScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraRef, setCameraRef] = useState(null);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [currentLabelIndex, setCurrentLabelIndex] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [damagePhotoCount, setDamagePhotoCount] = useState(0);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    requestPermissions();
  }, []);

  useEffect(() => {
    // Auto-scroll to the end when new photos are added
    if (capturedPhotos.length > 0 && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [capturedPhotos.length]);

  const requestPermissions = async () => {
    if (!permission?.granted) {
      await requestPermission();
    }
    
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'Please allow camera and media library access to continue.',
      );
    }
  };

  const capturePhoto = async () => {
    if (!cameraRef || isCapturing) return;
    
    setIsCapturing(true);
    try {
      const photo = await cameraRef.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      
      const currentLabel = PHOTO_LABELS[currentLabelIndex] || 'Additional';
      
      // For Damage Detail, add a counter
      let labelWithCount = currentLabel;
      if (currentLabelIndex === DAMAGE_DETAIL_INDEX) {
        const newCount = damagePhotoCount + 1;
        labelWithCount = `${currentLabel} ${newCount}`;
        setDamagePhotoCount(newCount);
      }
      
      const photoData = {
        uri: photo.uri,
        label: labelWithCount,
        timestamp: Date.now(),
      };
      
      setCapturedPhotos(prev => [...prev, photoData]);
      
      // Auto-advance to next label ONLY if NOT on Damage Detail section
      if (currentLabelIndex < DAMAGE_DETAIL_INDEX) {
        setCurrentLabelIndex(currentLabelIndex + 1);
      }
      // If on Damage Detail, stay on same label to allow multiple photos
      
    } catch (error) {
      console.error('Error capturing photo:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const selectFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 20,
        quality: 0.8,
      });

      if (!result.canceled) {
        const newPhotos = result.assets.map((asset, index) => ({
          uri: asset.uri,
          label: 'From Gallery',
          timestamp: Date.now() + index,
        }));
        
        setCapturedPhotos(prev => [...prev, ...newPhotos]);
        
        Alert.alert(
          'Photos Added',
          `${newPhotos.length} photo(s) added from gallery`
        );
      }
    } catch (error) {
      console.error('Error selecting from gallery:', error);
      Alert.alert('Error', 'Failed to select photos from gallery.');
    }
  };

  const removePhoto = (timestamp) => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setCapturedPhotos(prev => prev.filter(photo => photo.timestamp !== timestamp));
          }
        }
      ]
    );
  };

  const proceedToZoneEstimator = () => {
    if (capturedPhotos.length === 0) {
      Alert.alert('No Photos', 'Please capture or select at least one photo.');
      return;
    }

    // Extract just the URIs for the ZoneEstimator
    const photoUris = capturedPhotos.map(photo => photo.uri);
    
    navigation.navigate('ZoneEstimator', { 
      photos: photoUris,
      totalPhotos: capturedPhotos.length,
      photoData: capturedPhotos, // Include full data with labels
    });
  };

  const getCurrentLabel = () => {
    if (currentLabelIndex < PHOTO_LABELS.length) {
      return PHOTO_LABELS[currentLabelIndex];
    }
    return 'Additional Photos';
  };

  const resetGuide = () => {
    setCurrentLabelIndex(0);
    setDamagePhotoCount(0);
  };

  const skipToNextLabel = () => {
    if (currentLabelIndex < PHOTO_LABELS.length - 1) {
      setCurrentLabelIndex(currentLabelIndex + 1);
      if (currentLabelIndex + 1 !== DAMAGE_DETAIL_INDEX) {
        setDamagePhotoCount(0);
      }
    }
  };

  const goToPreviousLabel = () => {
    if (currentLabelIndex > 0) {
      setCurrentLabelIndex(currentLabelIndex - 1);
      if (currentLabelIndex - 1 !== DAMAGE_DETAIL_INDEX) {
        setDamagePhotoCount(0);
      }
    }
  };

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.permissionText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <MaterialCommunityIcons name="camera-off" size={64} color="#6b7280" />
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionText}>
          Please allow camera access to capture photos for damage assessment.
        </Text>
        <Button
          mode="contained"
          onPress={requestPermission}
          style={styles.permissionButton}
          buttonColor="#2563EB"
        >
          Grant Camera Permission
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView 
        style={styles.camera}
        ref={setCameraRef}
        facing="back"
      >
        {/* Ghost Guide Label */}
        <View style={styles.guideLabelContainer}>
          <View style={styles.guideLabelBox}>
            <Text style={styles.guideLabelText}>Snap Photo of:</Text>
            <Text style={styles.guideLabelValue}>{getCurrentLabel()}</Text>
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                {currentLabelIndex + 1} / {PHOTO_LABELS.length}
              </Text>
            </View>
            {currentLabelIndex === DAMAGE_DETAIL_INDEX && damagePhotoCount > 0 && (
              <Text style={styles.damageCountText}>
                {damagePhotoCount} damage photo{damagePhotoCount !== 1 ? 's' : ''} captured
              </Text>
            )}
          </View>
          
          {/* Navigation Controls for Ghost Guide */}
          <View style={styles.guideNavigation}>
            {currentLabelIndex > 0 && (
              <TouchableOpacity
                style={styles.guideNavButton}
                onPress={goToPreviousLabel}
              >
                <MaterialCommunityIcons name="chevron-left" size={20} color="white" />
                <Text style={styles.guideNavText}>Previous</Text>
              </TouchableOpacity>
            )}
            
            {currentLabelIndex < PHOTO_LABELS.length - 1 && (
              <TouchableOpacity
                style={[styles.guideNavButton, styles.guideNavButtonRight]}
                onPress={skipToNextLabel}
              >
                <Text style={styles.guideNavText}>
                  {currentLabelIndex === DAMAGE_DETAIL_INDEX - 1 ? 'Start Damage Photos' : 'Skip'}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="white" />
              </TouchableOpacity>
            )}
            
            {currentLabelIndex === DAMAGE_DETAIL_INDEX && damagePhotoCount > 0 && (
              <TouchableOpacity
                style={[styles.guideNavButton, styles.guideNavButtonDone]}
                onPress={() => setCurrentLabelIndex(PHOTO_LABELS.length)}
              >
                <MaterialCommunityIcons name="check" size={20} color="white" />
                <Text style={styles.guideNavText}>Done with Damage Photos</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Reset Guide Button */}
          {currentLabelIndex >= PHOTO_LABELS.length && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetGuide}
            >
              <MaterialCommunityIcons name="restart" size={20} color="white" />
              <Text style={styles.resetButtonText}>Reset Guide</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Photo Count Badge */}
        <View style={styles.photoCountBadge}>
          <MaterialCommunityIcons name="image-multiple" size={20} color="white" />
          <Text style={styles.photoCountText}>{capturedPhotos.length}</Text>
        </View>

        {/* Bottom Controls Area */}
        <View style={styles.bottomSection}>
          
          {/* Photo Tray */}
          {capturedPhotos.length > 0 && (
            <View style={styles.trayContainer}>
              <ScrollView
                ref={scrollViewRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.trayContent}
              >
                {capturedPhotos.map((photo) => (
                  <TouchableOpacity
                    key={photo.timestamp}
                    style={styles.thumbnailContainer}
                    onLongPress={() => removePhoto(photo.timestamp)}
                  >
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.thumbnail}
                    />
                    <View style={styles.thumbnailLabel}>
                      <Text style={styles.thumbnailLabelText} numberOfLines={1}>
                        {photo.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Control Buttons */}
          <View style={styles.controlsContainer}>
            
            {/* Gallery Button */}
            <TouchableOpacity
              style={styles.sideButton}
              onPress={selectFromGallery}
            >
              <MaterialCommunityIcons name="image-multiple" size={32} color="white" />
              <Text style={styles.sideButtonText}>Gallery</Text>
            </TouchableOpacity>

            {/* Shutter Button */}
            <TouchableOpacity
              style={[styles.shutterButton, isCapturing && styles.shutterButtonDisabled]}
              onPress={capturePhoto}
              disabled={isCapturing}
            >
              {isCapturing ? (
                <ActivityIndicator size="large" color="white" />
              ) : (
                <View style={styles.shutterButtonInner} />
              )}
            </TouchableOpacity>

            {/* Done Button */}
            <TouchableOpacity
              style={[
                styles.sideButton,
                styles.doneButton,
                capturedPhotos.length === 0 && styles.doneButtonDisabled
              ]}
              onPress={proceedToZoneEstimator}
              disabled={capturedPhotos.length === 0}
            >
              <MaterialCommunityIcons 
                name="check-circle" 
                size={32} 
                color={capturedPhotos.length === 0 ? '#9ca3af' : '#10b981'} 
              />
              <Text style={[
                styles.sideButtonText,
                capturedPhotos.length === 0 && styles.doneButtonTextDisabled
              ]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>

      {/* Loading Modal */}
      <Portal>
        <Modal visible={isCapturing} dismissable={false}>
          <View style={styles.loadingModal}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Capturing photo...</Text>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f5f5f5',
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  
  // Ghost Guide Label
  guideLabelContainer: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  guideLabelBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  guideLabelText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 4,
  },
  guideLabelValue: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  progressContainer: {
    backgroundColor: 'rgba(37, 99, 235, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  progressText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Guide Navigation
  guideNavigation: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  guideNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(107, 114, 128, 0.8)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  guideNavButtonRight: {
    backgroundColor: 'rgba(37, 99, 235, 0.8)',
  },
  guideNavButtonDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.8)',
  },
  guideNavText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  damageCountText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },
  
  // Photo Count Badge
  photoCountBadge: {
    position: 'absolute',
    top: 40,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  photoCountText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  // Bottom Section
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  
  // Photo Tray
  trayContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 12,
    marginBottom: 8,
  },
  trayContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  thumbnailContainer: {
    position: 'relative',
    marginRight: 12,
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'white',
  },
  thumbnailLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  thumbnailLabelText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Controls
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  sideButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
  },
  sideButtonText: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 12,
    padding: 8,
  },
  doneButtonDisabled: {
    backgroundColor: 'rgba(156, 163, 175, 0.2)',
  },
  doneButtonTextDisabled: {
    color: '#9ca3af',
  },
  
  // Shutter Button
  shutterButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'white',
  },
  shutterButtonDisabled: {
    opacity: 0.5,
  },
  shutterButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'white',
  },

  // Loading Modal
  loadingModal: {
    backgroundColor: 'white',
    padding: 24,
    margin: 32,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 8,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#374151',
  },
});