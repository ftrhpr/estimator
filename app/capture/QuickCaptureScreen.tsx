import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useNavigation } from 'expo-router';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Image,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    TouchableOpacity,
    Vibration,
    View,
} from 'react-native';
import {
    ActivityIndicator,
    Modal,
    Portal,
    Text
} from 'react-native-paper';

import { BORDER_RADIUS, COLORS, SHADOWS, SPACING } from '../../src/config/constants';

const { width, height } = Dimensions.get('window');
const STATUSBAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44;

interface CapturedPhoto {
  id: string;
  uri: string;
  timestamp: Date;
  angle?: 'Front' | 'Right Side' | 'Rear' | 'Left Side' | 'Damage Detail';
  voiceNote?: string;
  label?: string;
}

const QUICK_ANGLES = [
  { key: 'Front', icon: 'car-outline', label: 'წინა', emoji: '🚗' },
  { key: 'Right Side', icon: 'car-side', label: 'მარჯვენა', emoji: '➡️' },
  { key: 'Rear', icon: 'car-back', label: 'უკანა', emoji: '🔙' },
  { key: 'Left Side', icon: 'car-side', label: 'მარცხენა', emoji: '⬅️' },
  { key: 'Damage Detail', icon: 'magnify-plus-outline', label: 'დაზიანება', emoji: '🔍' },
];

const DAMAGE_INDEX = 4; // Index of "Damage Detail"

export const options = () => ({ title: 'სწრაფი გადაღება', headerShown: false });

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
  const [flashAnim] = useState(new Animated.Value(0));

  const cameraRef = useRef<CameraView>(null);

  // Flash animation on capture
  const triggerFlash = () => {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

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

  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const handlePickFromGallery = async () => {
    try {
      setIsCapturing(true);
      
      // Request permission to access media library
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'ნებართვა საჭიროა',
          'გთხოვთ მიეცით გალერეაზე წვდომა ფოტოების ასარჩევად.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
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
      Alert.alert('შეცდომა', 'ვერ მოხერხდა ფოტოს არჩევა გალერეადან');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      Vibration.vibrate(50);
      triggerFlash();
      
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
      Alert.alert('შეცდომა', 'ფოტოს გადაღება ვერ მოხერხდა');
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
        'ფოტო არ არის',
        'გთხოვთ გადაიღოთ მინიმუმ ერთი ფოტო.',
        [{ text: 'კარგი' }]
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
    <View style={styles.photoPreviewCard}>
      <Image source={{ uri: item.uri }} style={styles.previewImage} />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.previewOverlayGradient}
      >
        <View style={styles.previewCardInfo}>
          <View style={styles.previewAngleBadge}>
            <Text style={styles.previewAngleText}>{item.label || item.angle}</Text>
          </View>
          <View style={styles.previewCardActions}>
            {item.voiceNote && (
              <View style={styles.voiceIndicator}>
                <MaterialCommunityIcons name="microphone" size={14} color={COLORS.success} />
              </View>
            )}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => deletePhoto(item.id)}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={16} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  // ── Photo thumbnail strip item ──
  const renderThumbnail = ({ item, index }: { item: CapturedPhoto; index: number }) => (
    <TouchableOpacity
      style={styles.thumbnailWrap}
      onPress={() => setShowPreview(true)}
    >
      <Image source={{ uri: item.uri }} style={styles.thumbnailImage} />
      <View style={styles.thumbnailBadge}>
        <Text style={styles.thumbnailBadgeText}>{index + 1}</Text>
      </View>
    </TouchableOpacity>
  );

  // ── Get completion percentage ──
  const standardAnglesCompleted = QUICK_ANGLES
    .slice(0, DAMAGE_INDEX)
    .filter(a => photos.some(p => p.angle === a.key)).length;
  const completionPct = Math.round((standardAnglesCompleted / DAMAGE_INDEX) * 100);

  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>კამერის ჩატვირთვა...</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionCard}>
          <LinearGradient
            colors={[COLORS.primary + '12', COLORS.primary + '04']}
            style={styles.permissionIconCircle}
          >
            <MaterialCommunityIcons 
              name="camera-off" 
              size={56} 
              color={COLORS.primary} 
            />
          </LinearGradient>
          <Text style={styles.permissionTitle}>კამერაზე წვდომა საჭიროა</Text>
          <Text style={styles.permissionText}>
            აპლიკაციას ესაჭიროება კამერაზე წვდომა დაზიანების ფოტოების გადასაღებად
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryDark]}
              style={styles.permissionBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <MaterialCommunityIcons name="camera" size={20} color="#FFF" />
              <Text style={styles.permissionBtnText}>კამერაზე წვდომის მიცემა</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Camera View — Full Screen */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
      >
        {/* Flash Overlay */}
        <Animated.View
          pointerEvents="none"
          style={[styles.flashOverlay, { opacity: flashAnim }]}
        />

        {/* Top Safe Area + Header */}
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'transparent']}
          style={styles.topGradient}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>📸 სწრაფი გადაღება</Text>
              {photos.length > 0 && (
                <View style={styles.headerCountBadge}>
                  <Text style={styles.headerCountText}>{photos.length}</Text>
                </View>
              )}
            </View>

            <View style={styles.headerRightGroup}>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
              >
                <MaterialCommunityIcons name="camera-flip-outline" size={22} color="#FFF" />
              </TouchableOpacity>
              {photos.length > 0 && (
                <TouchableOpacity
                  style={styles.headerBtn}
                  onPress={() => setShowPreview(true)}
                >
                  <MaterialCommunityIcons name="image-multiple-outline" size={22} color="#FFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* Angle Selector Strip — below header */}
        <View style={styles.angleSelectorWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.angleSelectorScroll}>
            {QUICK_ANGLES.map((angle, index) => {
              const isActive = currentAngleIndex === index;
              const hasPhoto = photos.some(p => p.angle === angle.key);
              return (
                <TouchableOpacity
                  key={angle.key}
                  style={[
                    styles.angleCard,
                    isActive && styles.angleCardActive,
                    hasPhoto && !isActive && styles.angleCardDone,
                  ]}
                  onPress={() => selectAngle(angle.key, index)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={angle.icon as any}
                    size={18}
                    color={isActive ? '#FFF' : hasPhoto ? COLORS.success : 'rgba(255,255,255,0.7)'}
                  />
                  <Text style={[
                    styles.angleCardText,
                    isActive && styles.angleCardTextActive,
                    hasPhoto && !isActive && styles.angleCardTextDone,
                  ]}>
                    {angle.label}
                  </Text>
                  {hasPhoto && !isActive && (
                    <View style={styles.angleCheckmark}>
                      <MaterialCommunityIcons name="check" size={10} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Center — Progress + Navigation */}
        <View style={styles.centerOverlay}>
          {/* Progress Pill */}
          <View style={styles.progressPill}>
            <Text style={styles.progressPillText}>
              {currentAngleIndex + 1}/{QUICK_ANGLES.length}
            </Text>
            <View style={styles.progressBarWrap}>
              <View style={[styles.progressBarFill, { width: `${completionPct}%` }]} />
            </View>
            {currentAngleIndex === DAMAGE_INDEX && damagePhotoCount > 0 && (
              <Text style={styles.damagePillText}>
                🔍 {damagePhotoCount} დაზიანების ფოტო
              </Text>
            )}
          </View>

          {/* Navigation Arrows */}
          <View style={styles.navigationRow}>
            {currentAngleIndex > 0 && (
              <TouchableOpacity style={styles.navArrow} onPress={goToPreviousAngle}>
                <MaterialCommunityIcons name="chevron-left" size={22} color="#FFF" />
                <Text style={styles.navArrowText}>წინა</Text>
              </TouchableOpacity>
            )}

            <View style={{ flex: 1 }} />

            {currentAngleIndex < QUICK_ANGLES.length - 1 && (
              <TouchableOpacity
                style={[styles.navArrow, styles.navArrowNext]}
                onPress={goToNextAngle}
              >
                <Text style={styles.navArrowText}>
                  {currentAngleIndex === DAMAGE_INDEX - 1 ? 'დაზიანება' : 'გამოტოვება'}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={22} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Bottom Gradient Overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.65)']}
          style={styles.bottomGradient}
        >
          {/* Photo Thumbnail Strip */}
          {photos.length > 0 && (
            <FlatList
              data={photos}
              renderItem={renderThumbnail}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailStrip}
              style={styles.thumbnailStripWrap}
            />
          )}

          {/* Controls Row */}
          <View style={styles.controlsRow}>
            {/* Voice */}
            <TouchableOpacity
              style={[styles.controlBtn, isRecording && styles.controlBtnRecording]}
              onPress={handleVoiceRecording}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={isRecording ? 'microphone' : 'microphone-outline'}
                size={22}
                color={isRecording ? COLORS.error : '#FFF'}
              />
              <Text style={[styles.controlBtnLabel, isRecording && { color: COLORS.error }]}>
                {isRecording ? 'შეწყვეტა' : 'ხმოვანი'}
              </Text>
            </TouchableOpacity>

            {/* Gallery */}
            <TouchableOpacity
              style={[styles.controlBtn, isCapturing && { opacity: 0.4 }]}
              onPress={handlePickFromGallery}
              disabled={isCapturing}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="image-outline" size={22} color="#FFF" />
              <Text style={styles.controlBtnLabel}>გალერეა</Text>
            </TouchableOpacity>

            {/* Capture Button — Central */}
            <TouchableOpacity
              style={styles.captureOuter}
              onPress={handleTakePhoto}
              disabled={isCapturing}
              activeOpacity={0.8}
            >
              <View style={[styles.captureRing, isCapturing && { borderColor: COLORS.text.disabled }]}>
                {isCapturing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <View style={styles.captureInner} />
                )}
              </View>
            </TouchableOpacity>

            {/* Done */}
            <TouchableOpacity
              style={[styles.controlBtn, photos.length === 0 && { opacity: 0.3 }]}
              onPress={handleDone}
              disabled={photos.length === 0}
              activeOpacity={0.7}
            >
              <View style={[
                styles.doneIconCircle,
                photos.length > 0 && styles.doneIconCircleActive,
              ]}>
                <MaterialCommunityIcons
                  name="check"
                  size={18}
                  color={photos.length > 0 ? '#FFF' : 'rgba(255,255,255,0.5)'}
                />
              </View>
              <Text style={[styles.controlBtnLabel, photos.length > 0 && { color: COLORS.success }]}>
                მზადაა
              </Text>
            </TouchableOpacity>

            {/* Flip (extra small) */}
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="camera-flip-outline" size={20} color="rgba(255,255,255,0.7)" />
              <Text style={[styles.controlBtnLabel, { color: 'rgba(255,255,255,0.5)' }]}>შეცვლა</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </CameraView>

      {/* Photo Preview Modal */}
      <Portal>
        <Modal
          visible={showPreview}
          onDismiss={() => setShowPreview(false)}
          contentContainerStyle={styles.previewModal}
        >
          {/* Modal Header */}
          <View style={styles.previewHeader}>
            <View style={styles.previewHeaderLeft}>
              <MaterialCommunityIcons name="image-multiple" size={22} color={COLORS.primary} />
              <Text style={styles.previewTitle}>გადაღებული ფოტოები</Text>
              <View style={styles.previewCountBadge}>
                <Text style={styles.previewCountText}>{photos.length}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setShowPreview(false)} style={styles.previewCloseBtn}>
              <MaterialCommunityIcons name="close" size={22} color={COLORS.text.secondary} />
            </TouchableOpacity>
          </View>
          
          {photos.length > 0 ? (
            <FlatList
              data={photos}
              renderItem={renderPhotoPreview}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={styles.previewGrid}
              columnWrapperStyle={styles.previewGridRow}
            />
          ) : (
            <View style={styles.emptyPreview}>
              <MaterialCommunityIcons
                name="camera-plus-outline"
                size={56}
                color={COLORS.text.disabled}
              />
              <Text style={styles.emptyPreviewText}>
                ფოტოები ჯერ არ არის გადაღებული
              </Text>
            </View>
          )}
          
          <View style={styles.previewFooter}>
            <TouchableOpacity
              onPress={() => setShowPreview(false)}
              style={styles.previewContinueBtn}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryDark]}
                style={styles.previewContinueGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <MaterialCommunityIcons name="camera" size={18} color="#FFF" />
                <Text style={styles.previewContinueText}>გადაღების გაგრძელება</Text>
              </LinearGradient>
            </TouchableOpacity>
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

  // ── Flash Overlay ──
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFF',
    zIndex: 999,
  },

  // ── Top Gradient + Header ──
  topGradient: {
    paddingTop: STATUSBAR_HEIGHT + 4,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.3,
  },
  headerCountBadge: {
    backgroundColor: COLORS.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  headerRightGroup: {
    flexDirection: 'row',
    gap: 6,
  },

  // ── Angle Selector ──
  angleSelectorWrap: {
    position: 'absolute',
    top: STATUSBAR_HEIGHT + 52,
    left: 0,
    right: 0,
  },
  angleSelectorScroll: {
    paddingHorizontal: 10,
    gap: 6,
  },
  angleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  angleCardActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  angleCardDone: {
    borderColor: COLORS.success + '60',
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
  angleCardText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  angleCardTextActive: {
    color: '#FFF',
  },
  angleCardTextDone: {
    color: COLORS.success,
  },
  angleCheckmark: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },

  // ── Center Overlay ──
  centerOverlay: {
    position: 'absolute',
    top: STATUSBAR_HEIGHT + 100,
    left: 12,
    right: 12,
    alignItems: 'center',
    gap: 12,
  },
  progressPill: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 100,
  },
  progressPillText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  progressBarWrap: {
    width: 80,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: 2,
  },
  damagePillText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    marginTop: 4,
  },
  navigationRow: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
  },
  navArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(107,114,128,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  navArrowNext: {
    backgroundColor: 'rgba(37,99,235,0.7)',
  },
  navArrowText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Bottom Gradient ──
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    paddingTop: 30,
  },

  // ── Thumbnail Strip ──
  thumbnailStripWrap: {
    marginBottom: 12,
  },
  thumbnailStrip: {
    paddingHorizontal: 12,
    gap: 6,
  },
  thumbnailWrap: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbnailBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFF',
  },

  // ── Controls Row ──
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 52,
  },
  controlBtnRecording: {},
  controlBtnLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },

  // ── Capture Button ──
  captureOuter: {
    width: 76,
    height: 76,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF',
  },

  // ── Done Icon ──
  doneIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneIconCircleActive: {
    backgroundColor: COLORS.success,
  },

  // ── Loading ──
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingCard: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: COLORS.text.secondary,
    fontSize: 14,
  },

  // ── Permission ──
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },
  permissionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    width: '100%',
    ...SHADOWS.md,
  },
  permissionIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionText: {
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    fontSize: 14,
  },
  permissionButton: {
    width: '100%',
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  permissionBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.lg,
  },
  permissionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },

  // ── Preview Modal ──
  previewModal: {
    backgroundColor: COLORS.surface,
    margin: 16,
    borderRadius: BORDER_RADIUS.xl,
    maxHeight: height * 0.82,
    overflow: 'hidden',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
  },
  previewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  previewCountBadge: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  previewCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  previewCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewGrid: {
    padding: 12,
  },
  previewGridRow: {
    gap: 8,
  },
  photoPreviewCard: {
    flex: 1,
    margin: 4,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceVariant,
    maxWidth: (width - 56) / 2,
  },
  previewImage: {
    width: '100%',
    height: 130,
    resizeMode: 'cover',
  },
  previewOverlayGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
  },
  previewCardInfo: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  previewAngleBadge: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  previewAngleText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  previewCardActions: {
    flexDirection: 'row',
    gap: 4,
  },
  voiceIndicator: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPreview: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyPreviewText: {
    color: COLORS.text.disabled,
    marginTop: 12,
    fontSize: 14,
  },
  previewFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  previewContinueBtn: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  previewContinueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.lg,
  },
  previewContinueText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});