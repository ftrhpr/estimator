import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Alert,
  Vibration,
  Image,
  FlatList,
} from 'react-native';
import {
  Appbar,
  Text,
  FAB,
  Card,
  IconButton,
  Chip,
  Portal,
  Modal,
  Button,
  ActivityIndicator,
} from 'react-native-paper';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../src/config/constants';

const { width, height } = Dimensions.get('window');

interface CapturedPhoto {
  id: string;
  uri: string;
  timestamp: Date;
  angle?: 'Front' | 'Right Side' | 'Rear' | 'Left Side' | 'Damage Detail';
  voiceNote?: string;
  label?: string;
}

const QUICK_ANGLES = [
  { key: 'Front', icon: 'car', label: 'Front' },
  { key: 'Right Side', icon: 'car-side', label: 'Right Side' },
  { key: 'Rear', icon: 'car', label: 'Rear' },
  { key: 'Left Side', icon: 'car-side', label: 'Left Side' },
  { key: 'Damage Detail', icon: 'magnify-plus-outline', label: 'Damage Detail' },
];

const DAMAGE_INDEX = 4; // Index of "Damage Detail"

export default function QuickCaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [currentAngle, setCurrentAngle] = useState<string>('Front');
  const [currentAngleIndex, setCurrentAngleIndex] = useState<number>(0);
  const [damagePhotoCount, setDamagePhotoCount] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [isCapturing, setIsCapturing] = useState(false);
  
  const cameraRef = useRef<CameraView>(null);

  // Request permissions on focus
  useFocusEffect(
    useCallback(() => {
      const setupPermissions = async () => {
        if (!permission?.granted) {
          await requestPermission();
        }
        
        // Request audio permission for voice notes
        const { status } = await Audio.requestPermissionsAsync();
        if (status === 'granted') {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
          });
        }
      };
      
      setupPermissions();
    }, [permission])
  );

  const handlePickFromGallery = async () => {
    try {
      setIsCapturing(true);
      
      // Request permission to access media library
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to select photos.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const photo = result.assets[0];
        Vibration.vibrate(50); // Haptic feedback

        // For Damage Detail, add a counter to the label
        let photoLabel = currentAngle;
        if (currentAngleIndex === DAMAGE_INDEX) {
          const newCount = damagePhotoCount + 1;
          photoLabel = `${currentAngle} ${newCount}`;
          setDamagePhotoCount(newCount);
        }

        const newPhoto: CapturedPhoto = {
          id: Date.now().toString(),
          uri: photo.uri,
          timestamp: new Date(),
          angle: currentAngle as any,
          label: photoLabel,
        };

        setPhotos(prev => [...prev, newPhoto]);
        
        // Auto-advance ONLY if NOT on Damage Detail section
        if (currentAngleIndex < DAMAGE_INDEX) {
          autoAdvanceAngle();
        }
      }
    } catch (error) {
      console.error('Error picking photo:', error);
      Alert.alert('Error', 'Failed to select photo from gallery');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      Vibration.vibrate(50); // Haptic feedback
      
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (photo) {
        // For Damage Detail, add a counter to the label
        let photoLabel = currentAngle;
        if (currentAngleIndex === DAMAGE_INDEX) {
          const newCount = damagePhotoCount + 1;
          photoLabel = `${currentAngle} ${newCount}`;
          setDamagePhotoCount(newCount);
        }

        const newPhoto: CapturedPhoto = {
          id: Date.now().toString(),
          uri: photo.uri,
          timestamp: new Date(),
          angle: currentAngle as any,
          label: photoLabel,
        };

        setPhotos(prev => [...prev, newPhoto]);
        
        // Auto-advance ONLY if NOT on Damage Detail section
        if (currentAngleIndex < DAMAGE_INDEX) {
          autoAdvanceAngle();
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to capture photo');
    } finally {
      setIsCapturing(false);
    }
  };

  const autoAdvanceAngle = () => {
    const nextIndex = currentAngleIndex + 1;
    if (nextIndex < QUICK_ANGLES.length) {
      setCurrentAngleIndex(nextIndex);
      setCurrentAngle(QUICK_ANGLES[nextIndex].key);
    }
  };

  const goToPreviousAngle = () => {
    if (currentAngleIndex > 0) {
      const prevIndex = currentAngleIndex - 1;
      setCurrentAngleIndex(prevIndex);
      setCurrentAngle(QUICK_ANGLES[prevIndex].key);
      if (prevIndex !== DAMAGE_INDEX) {
        setDamagePhotoCount(0);
      }
    }
  };

  const goToNextAngle = () => {
    if (currentAngleIndex < QUICK_ANGLES.length - 1) {
      const nextIndex = currentAngleIndex + 1;
      setCurrentAngleIndex(nextIndex);
      setCurrentAngle(QUICK_ANGLES[nextIndex].key);
      if (nextIndex !== DAMAGE_INDEX) {
        setDamagePhotoCount(0);
      }
    }
  };

  const selectAngle = (angle: string, index: number) => {
    setCurrentAngle(angle);
    setCurrentAngleIndex(index);
    if (index !== DAMAGE_INDEX) {
      setDamagePhotoCount(0);
    }
  };

  const startVoiceRecording = async () => {
    try {
      const { recording } = await Audio.Recording.createAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      Vibration.vibrate(100); // Start recording feedback
    } catch (error) {
      console.error('Failed to start recording', error);
    }
  };

  const stopVoiceRecording = async () => {
    try {
      if (!recording) return;

      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      
      const uri = recording.getURI();
      Vibration.vibrate([50, 50]); // Stop recording feedback
      
      // For now, just show that we captured a voice note
      // In a real app, you'd save this audio file
      if (uri && photos.length > 0) {
        const lastPhoto = photos[photos.length - 1];
        setPhotos(prev => prev.map(photo => 
          photo.id === lastPhoto.id 
            ? { ...photo, voiceNote: uri }
            : photo
        ));
      }
      
      setRecording(null);
    } catch (error) {
      console.error('Failed to stop recording', error);
      setRecording(null);
      setIsRecording(false);
    }
  };

  const handleVoiceRecording = async () => {
    if (isRecording) {
      await stopVoiceRecording();
    } else {
      await startVoiceRecording();
    }
  };

  const deletePhoto = (photoId: string) => {
    setPhotos(prev => prev.filter(photo => photo.id !== photoId));
  };

  const handleDone = () => {
    if (photos.length === 0) {
      Alert.alert(
        'No Photos',
        'Please capture at least one photo before continuing.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Navigate to photo tagging screen with captured photos
    router.push({
      pathname: '/capture/PhotoTaggingScreen',
      params: {
        photos: JSON.stringify(photos.map(photo => ({
          id: photo.id,
          uri: photo.uri,
          angle: photo.angle || 'Unknown',
          timestamp: photo.timestamp.toISOString(),
        }))),
      },
    });
  };

  const renderPhotoPreview = ({ item }: { item: CapturedPhoto }) => (
    <View style={styles.photoPreview}>
      <Image source={{ uri: item.uri }} style={styles.previewImage} />
      <View style={styles.photoOverlay}>
        <Chip
          mode="flat"
          textStyle={styles.angleChipText}
          style={styles.angleChip}
        >
          {item.label || item.angle}
        </Chip>
        <View style={styles.photoActions}>
          {item.voiceNote && (
            <IconButton
              icon="microphone"
              size={16}
              iconColor={COLORS.success}
              style={styles.voiceIndicator}
            />
          )}
          <IconButton
            icon="delete"
            size={16}
            iconColor={COLORS.error}
            style={styles.deleteButton}
            onPress={() => deletePhoto(item.id)}
          />
        </View>
      </View>
    </View>
  );

  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <MaterialCommunityIcons 
          name="camera-off" 
          size={64} 
          color={COLORS.text.tertiary} 
        />
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionText}>
          This app needs camera access to capture damage photos
        </Text>
        <Button
          mode="contained"
          onPress={requestPermission}
          style={styles.permissionButton}
        >
          Grant Camera Access
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Quick Capture" titleStyle={styles.headerTitle} />
        <Appbar.Action 
          icon="image-multiple" 
          onPress={() => setShowPreview(true)} 
        />
        <Appbar.Action 
          icon="camera-flip" 
          onPress={() => setFacing(facing === 'back' ? 'front' : 'back')} 
        />
      </Appbar.Header>

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
        >
          {/* Angle Selection */}
          <View style={styles.angleSelector}>
            {QUICK_ANGLES.map((angle, index) => (
              <TouchableOpacity
                key={angle.key}
                style={[
                  styles.angleButton,
                  currentAngle === angle.key && styles.angleButtonActive
                ]}
                onPress={() => selectAngle(angle.key, index)}
              >
                <MaterialCommunityIcons
                  name={angle.icon as any}
                  size={20}
                  color={currentAngle === angle.key ? COLORS.text.onPrimary : COLORS.text.primary}
                />
                <Text
                  style={[
                    styles.angleButtonText,
                    currentAngle === angle.key && styles.angleButtonTextActive
                  ]}
                >
                  {angle.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressIndicator}>
            <View style={styles.progressBox}>
              <Text style={styles.progressText}>
                {currentAngleIndex + 1} / {QUICK_ANGLES.length}
              </Text>
              {currentAngleIndex === DAMAGE_INDEX && damagePhotoCount > 0 && (
                <Text style={styles.damageCountText}>
                  {damagePhotoCount} damage photo{damagePhotoCount !== 1 ? 's' : ''}
                </Text>
              )}
            </View>
          </View>

          {/* Navigation Controls */}
          <View style={styles.navigationControls}>
            {currentAngleIndex > 0 && (
              <TouchableOpacity
                style={styles.navButton}
                onPress={goToPreviousAngle}
              >
                <MaterialCommunityIcons name="chevron-left" size={20} color="white" />
                <Text style={styles.navButtonText}>Previous</Text>
              </TouchableOpacity>
            )}
            
            {currentAngleIndex < QUICK_ANGLES.length - 1 && (
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonNext]}
                onPress={goToNextAngle}
              >
                <Text style={styles.navButtonText}>
                  {currentAngleIndex === DAMAGE_INDEX - 1 ? 'Start Damage' : 'Skip'}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="white" />
              </TouchableOpacity>
            )}

            {currentAngleIndex === DAMAGE_INDEX && damagePhotoCount > 0 && (
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonDone]}
                onPress={() => {
                  setCurrentAngleIndex(QUICK_ANGLES.length);
                  Alert.alert('Damage Photos Complete', 'You can now review all photos or continue capturing.');
                }}
              >
                <MaterialCommunityIcons name="check" size={20} color="white" />
                <Text style={styles.navButtonText}>Done with Damage</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Photo count indicator */}
          <View style={styles.photoCounter}>
            <Text style={styles.photoCountText}>
              {photos.length} photo{photos.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </CameraView>
      </View>

      {/* Camera Controls */}
      <View style={styles.controls}>
        {/* Voice Note Button */}
        <TouchableOpacity
          style={[styles.voiceButton, isRecording && styles.voiceButtonActive]}
          onPress={handleVoiceRecording}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name={isRecording ? "microphone" : "microphone-outline"}
            size={24}
            color={isRecording ? COLORS.error : COLORS.text.secondary}
          />
          <Text style={[styles.voiceButtonText, isRecording && styles.voiceButtonTextActive]}>
            {isRecording ? 'Stop Note' : 'Voice Note'}
          </Text>
        </TouchableOpacity>

        {/* Gallery Picker Button */}
        <TouchableOpacity
          style={[styles.galleryButton, isCapturing && styles.galleryButtonDisabled]}
          onPress={handlePickFromGallery}
          disabled={isCapturing}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="image-multiple"
            size={24}
            color={COLORS.text.secondary}
          />
          <Text style={styles.galleryButtonText}>
            Gallery
          </Text>
        </TouchableOpacity>

        {/* Capture Button */}
        <TouchableOpacity
          style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
          onPress={handleTakePhoto}
          disabled={isCapturing}
          activeOpacity={0.8}
        >
          <View style={styles.captureButtonInner}>
            {isCapturing ? (
              <ActivityIndicator size="small" color={COLORS.text.onPrimary} />
            ) : (
              <MaterialCommunityIcons
                name="camera"
                size={32}
                color={COLORS.text.onPrimary}
              />
            )}
          </View>
        </TouchableOpacity>

        {/* Done Button */}
        <TouchableOpacity
          style={[styles.doneButton, photos.length === 0 && styles.doneButtonDisabled]}
          onPress={handleDone}
          disabled={photos.length === 0}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="check"
            size={24}
            color={photos.length > 0 ? COLORS.success : COLORS.text.disabled}
          />
          <Text style={[
            styles.doneButtonText,
            photos.length === 0 && styles.doneButtonTextDisabled
          ]}>
            Done
          </Text>
        </TouchableOpacity>
      </View>

      {/* Photo Preview Modal */}
      <Portal>
        <Modal
          visible={showPreview}
          onDismiss={() => setShowPreview(false)}
          contentContainerStyle={styles.previewModal}
        >
          <View style={styles.previewHeader}>
            <Text variant="titleLarge" style={styles.previewTitle}>
              Captured Photos ({photos.length})
            </Text>
            <IconButton
              icon="close"
              onPress={() => setShowPreview(false)}
            />
          </View>
          
          {photos.length > 0 ? (
            <FlatList
              data={photos}
              renderItem={renderPhotoPreview}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={styles.previewGrid}
            />
          ) : (
            <View style={styles.emptyPreview}>
              <MaterialCommunityIcons
                name="camera-outline"
                size={48}
                color={COLORS.text.tertiary}
              />
              <Text style={styles.emptyPreviewText}>
                No photos captured yet
              </Text>
            </View>
          )}
          
          <Button
            mode="contained"
            onPress={() => setShowPreview(false)}
            style={styles.previewCloseButton}
          >
            Continue Capturing
          </Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.surface,
    elevation: 2,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text.primary,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  angleSelector: {
    position: 'absolute',
    top: SPACING.lg,
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  angleButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    minWidth: 60,
  },
  angleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  angleButtonText: {
    fontSize: 10,
    color: COLORS.text.primary,
    marginTop: 2,
    fontWeight: '500',
  },
  angleButtonTextActive: {
    color: COLORS.text.onPrimary,
  },
  progressIndicator: {
    position: 'absolute',
    top: SPACING.xl * 3,
    alignSelf: 'center',
  },
  progressBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  progressText: {
    color: COLORS.text.onPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  damageCountText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  navigationControls: {
    position: 'absolute',
    top: SPACING.xl * 4.5,
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(107, 114, 128, 0.85)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    gap: 4,
  },
  navButtonNext: {
    backgroundColor: 'rgba(37, 99, 235, 0.85)',
  },
  navButtonDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.85)',
  },
  navButtonText: {
    color: COLORS.text.onPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  photoCounter: {
    position: 'absolute',
    top: SPACING.lg,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.lg,
  },
  photoCountText: {
    color: COLORS.text.onPrimary,
    fontSize: 12,
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  voiceButton: {
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 70,
  },
  voiceButtonActive: {
    backgroundColor: COLORS.errorLight,
  },
  voiceButtonText: {
    fontSize: 11,
    color: COLORS.text.secondary,
    marginTop: 4,
    fontWeight: '500',
  },
  voiceButtonTextActive: {
    color: COLORS.error,
  },
  galleryButton: {
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 70,
  },
  galleryButtonDisabled: {
    opacity: 0.5,
  },
  galleryButtonText: {
    fontSize: 11,
    color: COLORS.text.secondary,
    marginTop: 4,
    fontWeight: '500',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  captureButtonDisabled: {
    opacity: 0.7,
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButton: {
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 70,
  },
  doneButtonDisabled: {
    opacity: 0.5,
  },
  doneButtonText: {
    fontSize: 11,
    color: COLORS.success,
    marginTop: 4,
    fontWeight: '500',
  },
  doneButtonTextDisabled: {
    color: COLORS.text.disabled,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.text.secondary,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.background,
  },
  permissionTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text.primary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  permissionText: {
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 20,
  },
  permissionButton: {
    paddingHorizontal: SPACING.lg,
  },
  previewModal: {
    backgroundColor: COLORS.surface,
    margin: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    maxHeight: height * 0.8,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  previewTitle: {
    color: COLORS.text.primary,
  },
  previewGrid: {
    paddingHorizontal: SPACING.md,
  },
  photoPreview: {
    width: (width - SPACING.lg * 4) / 2,
    margin: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceVariant,
  },
  previewImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'space-between',
    padding: SPACING.xs,
  },
  angleChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  angleChipText: {
    fontSize: 10,
    color: COLORS.text.primary,
  },
  photoActions: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
  },
  voiceIndicator: {
    margin: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  deleteButton: {
    margin: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  emptyPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyPreviewText: {
    color: COLORS.text.tertiary,
    marginTop: SPACING.md,
  },
  previewCloseButton: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
});