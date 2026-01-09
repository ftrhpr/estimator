import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Image,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    Appbar,
    Button,
    List,
    Modal,
    Portal,
    Text,
    TextInput
} from 'react-native-paper';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';

import { BORDER_RADIUS, COLORS, SPACING, TYPOGRAPHY } from '../../src/config/constants';
import { DEFAULT_SERVICES } from '../../src/config/services';
import { ServiceService } from '../../src/services/serviceService';
import { formatCurrencyGEL } from '../../src/utils/helpers';

const { width, height } = Dimensions.get('window');

interface PhotoTag {
  id: string;
  x: number;
  y: number;
  xPercent?: number;
  yPercent?: number;
  serviceKey: string;
  serviceName: string;
  serviceNameKa: string;
  price: number;
  originalPrice: number;
}

interface TaggedPhoto {
  id: string;
  uri: string;
  angle: string;
  tags: PhotoTag[];
}

interface ServiceOption {
  key: string;
  nameEn: string;
  nameKa: string;
  basePrice: number;
  category: string;
  icon: string;
}

const SERVICE_ICONS: Record<string, string> = {
  painting: 'brush',
  paint_mixing: 'palette',
  plastic_restoration: 'auto-fix',
  robotic_work: 'robot',
  dent_repair: 'hammer',
  disassembly_assembly: 'wrench',
  polishing: 'star-circle',
};

export default function PhotoTaggingScreen() {
  const params = useLocalSearchParams();
  const [photos, setPhotos] = useState<TaggedPhoto[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showServiceMenu, setShowServiceMenu] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState({ x: 0, y: 0, xPercent: 0, yPercent: 0 });
  const [editingTag, setEditingTag] = useState<PhotoTag | null>(null);
  const [priceAdjustmentVisible, setPriceAdjustmentVisible] = useState(false);
  const [tempPrice, setTempPrice] = useState(0);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const [actualImageSize, setActualImageSize] = useState({ width: 0, height: 0 });
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });

  const priceScale = useSharedValue(1);
  const priceOpacity = useSharedValue(1);

  // Load services from database
  React.useEffect(() => {
    loadServicesFromDB();
  }, []);

  const loadServicesFromDB = async () => {
    try {
      setLoadingServices(true);
      const dbServices = await ServiceService.getAllServices();
      const serviceOptions: ServiceOption[] = dbServices.map(service => ({
        key: service.key,
        nameEn: service.nameEn,
        nameKa: service.nameKa,
        basePrice: service.basePrice,
        category: service.category,
        icon: SERVICE_ICONS[service.key] || 'wrench',
      }));
      setServices(serviceOptions);
    } catch (error) {
      console.error('Error loading services:', error);
      // Fallback to default services if database fails
      const fallbackServices: ServiceOption[] = Object.values(DEFAULT_SERVICES).map(service => ({
        ...service,
        icon: SERVICE_ICONS[service.key] || 'wrench',
      }));
      setServices(fallbackServices);
      Alert.alert('Notice', 'Using default services. Please check your connection.');
    } finally {
      setLoadingServices(false);
    }
  };

  // Initialize photos from route params
  React.useEffect(() => {
    const setMockPhotos = () => {
      const mockPhotos: TaggedPhoto[] = [
        {
          id: '1',
          uri: 'https://via.placeholder.com/400x300/E2E8F0/475569?text=Front+View',
          angle: 'Front',
          tags: [],
        },
        {
          id: '2', 
          uri: 'https://via.placeholder.com/400x300/E2E8F0/475569?text=Side+Damage',
          angle: 'Side',
          tags: [],
        },
        {
          id: '3',
          uri: 'https://via.placeholder.com/400x300/E2E8F0/475569?text=Dent+Close-up',
          angle: 'Damage Close-up',
          tags: [],
        },
      ];
      setPhotos(mockPhotos);
    };

    if (params.photos) {
      try {
        const photosData = JSON.parse(params.photos as string);
        const initialPhotos: TaggedPhoto[] = photosData.map((photo: any) => ({
          id: photo.id,
          uri: photo.uri,
          angle: photo.angle,
          tags: [],
        }));
        setPhotos(initialPhotos);
      } catch (error) {
        console.error('Error parsing photos:', error);
        // Fallback to mock photos for demo
        setMockPhotos();
      }
    } else {
      // Mock photos for demo when no params
      setMockPhotos();
    }
  }, [params.photos]);

  const handlePhotoPress = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    
    // Calculate the actual displayed image size with aspect ratio
    const imageAspect = actualImageSize.width / actualImageSize.height;
    const containerAspect = containerDimensions.width / containerDimensions.height;
    
    let displayWidth = containerDimensions.width;
    let displayHeight = containerDimensions.height;
    let offsetX = 0;
    let offsetY = 0;
    
    if (imageAspect > containerAspect) {
      // Image is wider - fit to width, letterbox top/bottom
      displayHeight = containerDimensions.width / imageAspect;
      offsetY = (containerDimensions.height - displayHeight) / 2;
    } else {
      // Image is taller - fit to height, letterbox left/right
      displayWidth = containerDimensions.height * imageAspect;
      offsetX = (containerDimensions.width - displayWidth) / 2;
    }
    
    // Adjust touch coordinates relative to the actual image
    const adjustedX = locationX - offsetX;
    const adjustedY = locationY - offsetY;
    
    // Check if tap is within the actual image bounds
    if (adjustedX < 0 || adjustedX > displayWidth || adjustedY < 0 || adjustedY > displayHeight) {
      // Tap is outside the image (in letterbox area)
      return;
    }
    
    // Store position as percentage for consistent display across different sizes
    const xPercent = displayWidth > 0 ? adjustedX / displayWidth : 0;
    const yPercent = displayHeight > 0 ? adjustedY / displayHeight : 0;
    
    setSelectedPosition({ 
      x: adjustedX, 
      y: adjustedY, 
      xPercent, 
      yPercent 
    });
    setImageLayout({ width: displayWidth, height: displayHeight, x: offsetX, y: offsetY });
    setShowServiceMenu(true);
  };

  const handleServiceSelect = (service: ServiceOption) => {
    const newTag: PhotoTag = {
      id: Date.now().toString(),
      x: selectedPosition.x,
      y: selectedPosition.y,
      xPercent: selectedPosition.xPercent || (selectedPosition.x / imageLayout.width),
      yPercent: selectedPosition.yPercent || (selectedPosition.y / imageLayout.height),
      serviceKey: service.key,
      serviceName: service.nameEn,
      serviceNameKa: service.nameKa,
      price: service.basePrice,
      originalPrice: service.basePrice,
    };

    setPhotos(prev => prev.map((photo, index) => 
      index === currentPhotoIndex
        ? { ...photo, tags: [...photo.tags, newTag] }
        : photo
    ));

    setShowServiceMenu(false);
  };

  const handleTagPress = (tag: PhotoTag) => {
    setEditingTag(tag);
    setTempPrice(tag.price);
    setPriceAdjustmentVisible(true);
  };

  const adjustPrice = (direction: 'up' | 'down') => {
    const increment = 10; // 10 GEL increments
    const newPrice = direction === 'up' 
      ? tempPrice + increment 
      : Math.max(tempPrice - increment, 0);
    
    setTempPrice(newPrice);
    
    // Animate the price change
    priceScale.value = withSpring(1.2, {}, () => {
      priceScale.value = withSpring(1);
    });
  };

  const handleManualPriceChange = (text: string) => {
    const numValue = parseFloat(text.replace(/[^0-9.]/g, ''));
    if (!isNaN(numValue) && numValue >= 0) {
      setTempPrice(numValue);
    } else if (text === '' || text === '0') {
      setTempPrice(0);
    }
  };

  const confirmPriceChange = () => {
    if (!editingTag) return;

    setPhotos(prev => prev.map((photo, index) =>
      index === currentPhotoIndex
        ? {
            ...photo,
            tags: photo.tags.map(tag =>
              tag.id === editingTag.id
                ? { ...tag, price: tempPrice }
                : tag
            ),
          }
        : photo
    ));

    setPriceAdjustmentVisible(false);
    setEditingTag(null);
  };

  const removeTag = (tagId: string) => {
    setPhotos(prev => prev.map((photo, index) =>
      index === currentPhotoIndex
        ? { ...photo, tags: photo.tags.filter(tag => tag.id !== tagId) }
        : photo
    ));
  };

  const getTotalEstimate = () => {
    return photos.reduce((total, photo) => 
      total + photo.tags.reduce((photoTotal, tag) => photoTotal + tag.price, 0), 0
    );
  };

  const getServiceCount = () => {
    return photos.reduce((count, photo) => count + photo.tags.length, 0);
  };

  const getGroupedServices = () => {
    const serviceMap: Record<string, { serviceName: string; serviceNameKa: string; totalPrice: number; count: number; serviceKey: string }> = {};

    photos.forEach((photo) => {
      photo.tags.forEach((tag) => {
        if (serviceMap[tag.serviceName]) {
          serviceMap[tag.serviceName].totalPrice += tag.price;
          serviceMap[tag.serviceName].count += 1;
        } else {
          serviceMap[tag.serviceName] = {
            serviceName: tag.serviceName,
            serviceNameKa: tag.serviceNameKa,
            totalPrice: tag.price,
            count: 1,
            serviceKey: tag.serviceKey,
          };
        }
      });
    });

    return Object.values(serviceMap);
  };

  const handleComplete = () => {
    const totalServices = getServiceCount();
    const totalPrice = getTotalEstimate();

    if (totalServices === 0) {
      Alert.alert(
        'No Services Tagged',
        'Please tag at least one service before completing the estimate.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Group services by name and sum prices
    const groupedServices = getGroupedServices();

    // Prepare photos data
    const photosData = photos.map(photo => ({
      url: photo.uri,
      label: photo.angle,
      uploadedAt: new Date().toISOString(),
    }));

    // Prepare parts data from tags
    const partsData: any[] = [];
    photos.forEach((photo, photoIndex) => {
      photo.tags.forEach(tag => {
        const existingPart = partsData.find(p => p.partName === tag.serviceName);
        const damageData = {
          photoIndex,
          x: tag.x,
          y: tag.y,
          xPercent: tag.xPercent,
          yPercent: tag.yPercent,
          services: [{
            name: tag.serviceName,
            price: tag.price,
          }]
        };
        if (existingPart) {
          existingPart.damages.push(damageData);
        } else {
          partsData.push({
            partName: tag.serviceName,
            damages: [damageData]
          });
        }
      });
    });

    // Prepare estimate data for summary screen
    const estimateData = {
      items: groupedServices.map(service => ({
        id: service.serviceKey,
        serviceName: service.serviceName,
        serviceNameKa: service.serviceNameKa,
        price: service.totalPrice,
        count: service.count,
      })),
      photos: photosData,
      parts: partsData,
      totalPrice,
      totalServices,
    };

    // Navigate to summary screen
    router.push({
      pathname: '/capture/EstimateSummaryScreen',
      params: {
        estimateData: JSON.stringify(estimateData),
      },
    });
  };

  const renderPhotoTag = (tag: PhotoTag) => {
    // Use percentage if available, otherwise use absolute coordinates
    const displayX = tag.xPercent !== undefined && imageLayout.width > 0
      ? tag.xPercent * imageLayout.width
      : tag.x;
    const displayY = tag.yPercent !== undefined && imageLayout.height > 0
      ? tag.yPercent * imageLayout.height
      : tag.y;
      
    return (
      <TouchableOpacity
        key={tag.id}
        style={[
          styles.photoTag,
          { left: displayX - 12, top: displayY - 12 }
        ]}
        onPress={() => handleTagPress(tag)}
        activeOpacity={0.8}
      >
      <View style={styles.tagDot}>
        <Text style={styles.tagNumber}>{photos[currentPhotoIndex].tags.indexOf(tag) + 1}</Text>
      </View>
      <View style={styles.tagLabel}>
        <Text style={styles.tagText}>{tag.serviceName}</Text>
        <Text style={styles.tagPrice}>{formatCurrencyGEL(tag.price)}</Text>
      </View>
    </TouchableOpacity>
  );
};

  const renderPhotoThumbnail = ({ item, index }: { item: TaggedPhoto; index: number }) => (
    <TouchableOpacity
      style={[
        styles.thumbnail,
        index === currentPhotoIndex && styles.thumbnailActive
      ]}
      onPress={() => setCurrentPhotoIndex(index)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: item.uri }} style={styles.thumbnailImage} />
      <View style={styles.thumbnailOverlay}>
        <Text style={styles.thumbnailAngle}>{item.angle}</Text>
        {item.tags.length > 0 && (
          <View style={styles.tagCount}>
            <Text style={styles.tagCountText}>{item.tags.length}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const animatedPriceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: priceScale.value }],
    opacity: priceOpacity.value,
  }));

  const currentPhoto = photos[currentPhotoIndex];

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content 
          title="Tag Damage"
          subtitle={`Photo ${currentPhotoIndex + 1} of ${photos.length}`}
          titleStyle={styles.headerTitle}
        />
        <Appbar.Action 
          icon="information-outline"
          onPress={() => Alert.alert('How to Tag', 'Tap directly on damage areas in the photo to assign services and pricing.')}
        />
      </Appbar.Header>

      {/* Photo Display */}
      <View style={styles.photoContainer}>
        {currentPhoto && (
          <TouchableOpacity
            activeOpacity={1}
            onPress={handlePhotoPress}
          >
            <View 
              style={styles.imageContainer}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setContainerDimensions({ width, height });
              }}
            >
              <Image 
                source={{ uri: currentPhoto.uri }} 
                style={styles.mainPhoto}
                resizeMode="contain"
                onLoad={(event) => {
                  const { width, height } = event.nativeEvent.source;
                  setActualImageSize({ width, height });
                }}
              />
            </View>
            
            {/* Photo Tags */}
            {currentPhoto.tags.map(renderPhotoTag)}

            {/* Tap instruction overlay */}
            {currentPhoto.tags.length === 0 && (
              <View style={styles.instructionOverlay}>
                <MaterialCommunityIcons 
                  name="gesture-tap" 
                  size={48} 
                  color={COLORS.text.onPrimary} 
                />
                <Text style={styles.instructionText}>
                  Tap on damage areas to assign services
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Photo Thumbnails */}
      <View style={styles.thumbnailContainer}>
        <FlatList
          data={photos}
          renderItem={renderPhotoThumbnail}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailList}
        />
      </View>

      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{getServiceCount()}</Text>
          <Text style={styles.summaryLabel}>Services</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{formatCurrencyGEL(getTotalEstimate())}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <Button
          mode="contained"
          onPress={handleComplete}
          style={styles.completeButton}
          disabled={getServiceCount() === 0}
        >
          Complete
        </Button>
      </View>

      {/* Service Selection Modal */}
      <Portal>
        <Modal
          visible={showServiceMenu}
          onDismiss={() => setShowServiceMenu(false)}
          contentContainerStyle={styles.serviceModal}
        >
          <Text style={styles.modalTitle}>Select Service</Text>
          <Text style={styles.modalSubtitle}>Choose the service needed for this damage</Text>
          
          {services.map((service) => (
            <List.Item
              key={service.key}
              title={service.nameEn}
              description={`${service.nameKa} • ${formatCurrencyGEL(service.basePrice)}`}
              left={(props) => (
                <List.Icon 
                  {...props} 
                  icon={service.icon}
                  color={COLORS.primary}
                />
              )}
              right={(props) => (
                <Text style={styles.servicePrice}>
                  {formatCurrencyGEL(service.basePrice)}
                </Text>
              )}
              onPress={() => handleServiceSelect(service)}
              style={styles.serviceItem}
            />
          ))}
        </Modal>
      </Portal>

      {/* Price Adjustment Modal */}
      <Portal>
        <Modal
          visible={priceAdjustmentVisible}
          onDismiss={() => setPriceAdjustmentVisible(false)}
          contentContainerStyle={styles.priceModal}
        >
          <Text style={styles.modalTitle}>Adjust Price</Text>
          <Text style={styles.modalSubtitle}>
            {editingTag?.serviceName}
          </Text>

          <View style={styles.priceAdjustment}>
            <TouchableOpacity
              style={styles.priceButton}
              onPress={() => adjustPrice('down')}
            >
              <MaterialCommunityIcons name="minus" size={24} color={COLORS.text.primary} />
            </TouchableOpacity>

            <Animated.View style={[styles.priceDisplay, animatedPriceStyle]}>
              <Text style={styles.currentPrice}>{formatCurrencyGEL(tempPrice)}</Text>
              {editingTag && tempPrice !== editingTag.originalPrice && (
                <Text style={styles.originalPrice}>
                  was {formatCurrencyGEL(editingTag.originalPrice)}
                </Text>
              )}
            </Animated.View>

            <TouchableOpacity
              style={styles.priceButton}
              onPress={() => adjustPrice('up')}
            >
              <MaterialCommunityIcons name="plus" size={24} color={COLORS.text.primary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.priceHint}>Tap + or - to adjust in 10 GEL increments</Text>

          <TextInput
            mode="outlined"
            label="Enter price manually"
            value={tempPrice.toString()}
            onChangeText={handleManualPriceChange}
            keyboardType="numeric"
            left={<TextInput.Affix text="₾" />}
            style={styles.manualPriceInput}
            dense
          />

          <View style={styles.priceActions}>
            <Button
              mode="outlined"
              onPress={() => editingTag && removeTag(editingTag.id)}
              style={styles.removeButton}
              textColor={COLORS.error}
            >
              Remove
            </Button>
            <Button
              mode="contained"
              onPress={confirmPriceChange}
              style={styles.confirmButton}
            >
              Confirm
            </Button>
          </View>
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
  photoContainer: {
    flex: 1,
    backgroundColor: COLORS.backgroundDark,
    position: 'relative',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  mainPhoto: {
    width: '100%',
    height: '100%',
  },
  photoTag: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 10,
  },
  tagDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    elevation: 3,
  },
  tagNumber: {
    color: COLORS.text.onPrimary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  tagLabel: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    minWidth: 100,
  },
  tagText: {
    color: COLORS.text.onPrimary,
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  tagPrice: {
    color: COLORS.secondaryLight,
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  instructionOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -75 }, { translateY: -50 }],
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    width: 150,
  },
  instructionText: {
    color: COLORS.text.onPrimary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  thumbnailContainer: {
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  thumbnailList: {
    paddingHorizontal: SPACING.md,
  },
  thumbnail: {
    width: 80,
    height: 60,
    marginRight: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  thumbnailActive: {
    borderColor: COLORS.primary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbnailOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  thumbnailAngle: {
    color: COLORS.text.onPrimary,
    fontSize: 8,
    fontWeight: '500',
  },
  tagCount: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 4,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagCountText: {
    color: COLORS.text.onPrimary,
    fontSize: 8,
    fontWeight: 'bold',
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
    elevation: 2,
  },
  summaryItem: {
    alignItems: 'center',
    marginRight: SPACING.lg,
  },
  summaryNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.outline,
    marginRight: SPACING.lg,
  },
  completeButton: {
    marginLeft: 'auto',
  },
  serviceModal: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    maxHeight: height * 0.7,
  },
  modalTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.primary,
    textAlign: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  serviceItem: {
    paddingHorizontal: SPACING.lg,
  },
  servicePrice: {
    color: COLORS.primary,
    fontWeight: 'bold',
    alignSelf: 'center',
  },
  priceModal: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
  },
  priceAdjustment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: SPACING.xl,
  },
  priceButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  priceDisplay: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: SPACING.lg,
  },
  currentPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  originalPrice: {
    fontSize: 14,
    color: COLORS.text.tertiary,
    marginTop: 4,
    textDecorationLine: 'line-through',
  },
  priceHint: {
    textAlign: 'center',
    color: COLORS.text.secondary,
    fontSize: 12,
    marginBottom: SPACING.md,
  },
  manualPriceInput: {
    marginBottom: SPACING.lg,
  },
  priceActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  removeButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 1,
  },
});