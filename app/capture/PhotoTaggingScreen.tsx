import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useLayoutEffect, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Image,
    PanResponder,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    Appbar,
    Button,
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

export const options = () => ({ title: 'Tag Photo' });

interface PhotoTag {
  id: string;
  x: number;
  y: number;
  xPercent?: number;
  yPercent?: number;
  serviceKey: string;
  serviceName: string;
  serviceNameKa: string;
  serviceNameEn?: string;
  description?: string;
  price: number;
  originalPrice: number;
  count: number;
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
  description?: string;
  sortOrder?: number;
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
  const [tempQuantity, setTempQuantity] = useState(1);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const [actualImageSize, setActualImageSize] = useState({ width: 0, height: 0 });
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const [showCustomServiceModal, setShowCustomServiceModal] = useState(false);
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServiceNameKa, setCustomServiceNameKa] = useState('');
  const [customServicePrice, setCustomServicePrice] = useState('');
  const [savingCustomService, setSavingCustomService] = useState(false);
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [draggingTagId, setDraggingTagId] = useState<string | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0, pageX: 0, pageY: 0 });
  const tagPanResponders = useRef<Record<string, any>>({});
  const [serviceOrder, setServiceOrder] = useState<ServiceOption[]>([]);

  const priceScale = useSharedValue(1);
  const priceOpacity = useSharedValue(1);

  // Load services from database
  React.useEffect(() => {
    loadServicesFromDB();
    setSortOrder(); // Set manual sort order
  }, []);

  // Clear pan responders when changing photos
  React.useEffect(() => {
    tagPanResponders.current = {};
  }, [currentPhotoIndex]);

  // Clear service state when modal opens/closes
  React.useEffect(() => {
    if (!showServiceMenu) {
      setServiceOrder([]);
    } else {
      // Initialize serviceOrder with current services when modal opens
      if (services.length > 0 && serviceOrder.length === 0) {
        setServiceOrder([...services]);
      }
    }
  }, [showServiceMenu]);

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

  const navigation = useNavigation();
  useLayoutEffect(() => {
    const current = photos?.[currentPhotoIndex];
    const angle = current?.angle || 'Tag Photo';
    const counter = photos?.length ? ` (${currentPhotoIndex + 1}/${photos.length})` : '';
    navigation.setOptions({ title: `${angle}${counter}` });
  }, [photos, currentPhotoIndex, navigation]);

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
      serviceName: service.nameKa, // Use Georgian as primary name
      serviceNameKa: service.nameKa,
      serviceNameEn: service.nameEn, // Store English as backup
      description: service.description || '',
      price: service.basePrice,
      originalPrice: service.basePrice,
      count: 1,
    };

    setPhotos(prev => prev.map((photo, index) =>
      index === currentPhotoIndex
        ? { ...photo, tags: [...photo.tags, newTag] }
        : photo
    ));

    setShowServiceMenu(false);
  };

  const saveServiceOrder = async (orderedServices: ServiceOption[]) => {
    try {
      const updates = orderedServices.map((service, index) => ({
        serviceKey: service.key,
        sortOrder: index,
      }));

      for (const update of updates) {
        await ServiceService.updateServiceByKey(update.serviceKey, { sortOrder: update.sortOrder });
      }
      console.log('Service order saved successfully');
    } catch (error) {
      console.error('Error saving service order:', error);
      Alert.alert('Error', 'Failed to save service order');
    }
  };

  // Manual service order (Georgian name order as specified)
  const MANUAL_SERVICE_ORDER = {
    'painting': 0,              // სამღებრო სამუშაო
    'paint_mixing': 1,          // საღებავის შეზავება
    'disassembly_assembly': 2,  // დაშლა აწყობა
    'dent_repair': 3,           // თუნუქის გასწორება
    'polishing': 4,             // პოლირება
    'robotic_work': 5,          // სარობოტე სამუშაო
  };

  const setSortOrder = async () => {
    try {
      for (const [key, sortOrder] of Object.entries(MANUAL_SERVICE_ORDER)) {
        await ServiceService.updateServiceByKey(key, { sortOrder });
      }
      console.log('Service order set successfully');
    } catch (error) {
      console.error('Error setting service order:', error);
    }
  };

  const handleTagPress = (tag: PhotoTag) => {
    setEditingTag(tag);
    setTempPrice(tag.price);
    setTempQuantity(tag.count || 1);
    setPriceAdjustmentVisible(true);
  };

  const createPanResponder = (tagId: string) => {
    if (tagPanResponders.current[tagId]) {
      return tagPanResponders.current[tagId];
    }

    let isMoving = false;
    let startTime = 0;

    const responder = PanResponder.create({
      // Don't capture on start - allow TouchableOpacity to handle taps
      onStartShouldSetPanResponder: () => false,
      // Only capture when there's significant movement (drag)
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        // Only become responder if moved more than 5 pixels (actual drag)
        return Math.abs(dx) > 5 || Math.abs(dy) > 5;
      },
      onPanResponderGrant: (event) => {
        isMoving = true;
        startTime = Date.now();
        // Store initial tag coordinates
        const currentPhoto = photos[currentPhotoIndex];
        const currentTag = currentPhoto?.tags.find(t => t.id === tagId);
        if (currentTag) {
          dragStartPos.current = { 
            x: currentTag.x, 
            y: currentTag.y,
            pageX: event.nativeEvent.pageX,
            pageY: event.nativeEvent.pageY,
          };
          setDraggingTagId(tagId);
        }
      },
      onPanResponderMove: (event) => {
        const { pageX, pageY } = event.nativeEvent;
        const currentPhoto = photos[currentPhotoIndex];
        const currentTag = currentPhoto?.tags.find(t => t.id === tagId);
        
        if (!currentTag || !dragStartPos.current.pageX) return;

        // Calculate delta in page coordinates
        const deltaX = pageX - dragStartPos.current.pageX;
        const deltaY = pageY - dragStartPos.current.pageY;
        
        // Apply delta to stored starting position
        let newX = dragStartPos.current.x + deltaX;
        let newY = dragStartPos.current.y + deltaY;
        
        // Clamp to image bounds
        newX = Math.max(0, Math.min(newX, imageLayout.width - 24));
        newY = Math.max(0, Math.min(newY, imageLayout.height - 24));

        setPhotos(prev => prev.map((photo, index) =>
          index === currentPhotoIndex
            ? {
                ...photo,
                tags: photo.tags.map(tag => {
                  if (tag.id === tagId) {
                    return {
                      ...tag,
                      x: newX,
                      y: newY,
                      xPercent: imageLayout.width > 0 ? newX / imageLayout.width : tag.xPercent,
                      yPercent: imageLayout.height > 0 ? newY / imageLayout.height : tag.yPercent,
                    };
                  }
                  return tag;
                })
              }
            : photo
        ));
      },
      onPanResponderRelease: () => {
        setDraggingTagId(null);
        dragStartPos.current = { x: 0, y: 0, pageX: 0, pageY: 0 };
      },
      onPanResponderTerminate: () => {
        setDraggingTagId(null);
        dragStartPos.current = { x: 0, y: 0, pageX: 0, pageY: 0 };
      },
    });

    tagPanResponders.current[tagId] = responder;
    return responder;
  };

  const adjustPrice = (direction: 'up' | 'down') => {
    const increment = 0.5; // 0.5 GEL increments for decimal support
    const newPrice = direction === 'up' 
      ? Math.round((tempPrice + increment) * 100) / 100
      : Math.max(Math.round((tempPrice - increment) * 100) / 100, 0);
    
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
                ? { ...tag, price: tempPrice, count: tempQuantity }
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

  const handleSaveCustomService = async () => {
    // Validate inputs
    if (!customServiceNameKa.trim()) {
      Alert.alert('Validation Error', 'Please enter service name in Georgian');
      return;
    }

    if (!customServicePrice.trim()) {
      Alert.alert('Validation Error', 'Please enter service price');
      return;
    }

    const price = parseFloat(customServicePrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid price');
      return;
    }

    try {
      setSavingCustomService(true);
      
      // Create unique key for the custom service
      const serviceKey = `custom_${Date.now()}`;
      
      // Save to database
      await ServiceService.createService({
        key: serviceKey,
        nameEn: customServiceName.trim() || customServiceNameKa.trim(),
        nameKa: customServiceNameKa.trim(),
        basePrice: price,
        category: 'specialized',
        isActive: true,
        sortOrder: services.length,
      });

      // Add to local services list
      const newService: ServiceOption = {
        key: serviceKey,
        nameEn: customServiceName.trim() || customServiceNameKa.trim(),
        nameKa: customServiceNameKa.trim(),
        basePrice: price,
        category: 'custom',
        icon: 'plus-circle',
      };

      setServices(prev => [...prev, newService]);

      // Automatically select the new service
      handleServiceSelect(newService);

      // Reset form and close modal
      setCustomServiceName('');
      setCustomServiceNameKa('');
      setCustomServicePrice('');
      setShowCustomServiceModal(false);

      Alert.alert('Success', 'Custom service created and saved to database');
    } catch (error) {
      console.error('Error saving custom service:', error);
      Alert.alert('Error', 'Failed to save custom service. Please try again.');
    } finally {
      setSavingCustomService(false);
    }
  };

  const getTotalEstimate = () => {
    return photos.reduce((total, photo) => 
      total + photo.tags.reduce((photoTotal, tag) => photoTotal + (tag.price * (tag.count || 1)), 0), 0
    );
  };

  const getServiceCount = () => {
    return photos.reduce((count, photo) => 
      count + photo.tags.reduce((tagCount, tag) => tagCount + (tag.count || 1), 0), 0
    );
  };

  const getCategories = () => {
    const categories = new Set(services.map(s => s.category));
    return Array.from(categories).sort();
  };

  const getFilteredAndGroupedServices = () => {
    let filtered = services;

    // Filter by search query
    if (serviceSearchQuery.trim()) {
      const query = serviceSearchQuery.toLowerCase();
      filtered = filtered.filter(service =>
        service.nameKa.toLowerCase().includes(query) ||
        service.nameEn.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(service => service.category === selectedCategory);
    }

    // Sort by sortOrder
    filtered.sort((a, b) => {
      const orderA = a.sortOrder ?? 999;
      const orderB = b.sortOrder ?? 999;
      return orderA - orderB;
    });

    // Group by category (but services within each category are already sorted)
    const grouped: Record<string, ServiceOption[]> = {};
    filtered.forEach(service => {
      if (!grouped[service.category]) {
        grouped[service.category] = [];
      }
      grouped[service.category].push(service);
    });

    return grouped;
  };

  const getGroupedServices = () => {
    const serviceMap: Record<string, { serviceName: string; serviceNameKa: string; totalPrice: number; count: number; serviceKey: string }> = {};

    photos.forEach((photo) => {
      photo.tags.forEach((tag) => {
        // Use serviceKey for grouping instead of serviceName to ensure proper matching
        const key = tag.serviceKey || tag.serviceName;
        const tagCount = tag.count || 1;
        const tagTotalPrice = tag.price * tagCount;
        
        if (serviceMap[key]) {
          serviceMap[key].totalPrice += tagTotalPrice;
          serviceMap[key].count += tagCount;
        } else {
          serviceMap[key] = {
            serviceName: tag.serviceName,
            serviceNameKa: tag.serviceNameKa,
            totalPrice: tagTotalPrice,
            count: tagCount,
            serviceKey: tag.serviceKey || tag.serviceName,
          };
        }
      });
    });

    console.log('Grouped services:', Object.values(serviceMap));
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
    // Calculate displayed image dimensions
    const aspectRatio = actualImageSize.width / actualImageSize.height;
    const containerAspectRatio = containerDimensions.width / containerDimensions.height;

    let displayWidth, displayHeight, offsetX, offsetY;

    if (aspectRatio > containerAspectRatio) {
      // Image is wider - constrained by width
      displayWidth = containerDimensions.width;
      displayHeight = containerDimensions.width / aspectRatio;
      offsetX = 0;
      offsetY = (containerDimensions.height - displayHeight) / 2;
    } else {
      // Image is taller - constrained by height
      displayHeight = containerDimensions.height;
      displayWidth = containerDimensions.height * aspectRatio;
      offsetY = 0;
      offsetX = (containerDimensions.width - displayWidth) / 2;
    }

    // Use percentage if available, otherwise use absolute coordinates
    const displayX = tag.xPercent !== undefined && displayWidth > 0
      ? tag.xPercent * displayWidth + offsetX
      : tag.x + offsetX;
    const displayY = tag.yPercent !== undefined && displayHeight > 0
      ? tag.yPercent * displayHeight + offsetY
      : tag.y + offsetY;

    const panResponder = createPanResponder(tag.id);
    const isDragging = draggingTagId === tag.id;

    return (
      <View
        key={tag.id}
        style={[
          styles.photoTag,
          { 
            left: displayX - 12, 
            top: displayY - 12,
            opacity: isDragging ? 0.8 : 1,
          }
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.tagDotContainer}
          onPress={() => handleTagPress(tag)}
          activeOpacity={0.8}
        >
          <View style={styles.tagDot}>
            <Text style={styles.tagNumber}>{photos[currentPhotoIndex].tags.indexOf(tag) + 1}</Text>
          </View>
          <View style={styles.tagLabel}>
            <Text style={styles.tagText}>{tag.serviceNameKa || tag.serviceName}</Text>
            <Text style={styles.tagPrice}>{formatCurrencyGEL(tag.price * (tag.count || 1))}</Text>
            {tag.count && tag.count !== 1 && (
              <Text style={styles.tagQuantity}>qty: {tag.count}</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
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
          title="დაზიანების მონიშვნა"
          subtitle={`ფოტო ${currentPhotoIndex + 1} / ${photos.length}`}
          titleStyle={styles.headerTitle}
        />
        <Appbar.Action 
          icon="information-outline"
          onPress={() => Alert.alert('როგორ მონიშნოთ', 'დააჭირეთ დაზიანებულ ადგილებს ფოტოზე სერვისისა და ფასის მისანიჭებლად.')}
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
              <View style={styles.instructionOverlay} pointerEvents="none">
                <MaterialCommunityIcons
                  name="gesture-tap"
                  size={48}
                  color={COLORS.text.onPrimary}
                />
                <Text style={styles.instructionText}>
                  დააჭირეთ დაზიანებულ ადგილებს სერვისის მისანიჭებლად
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
          onDismiss={() => {
            setShowServiceMenu(false);
            setServiceSearchQuery('');
            setSelectedCategory(null);
          }}
          contentContainerStyle={styles.serviceModal}
        >
          <View style={styles.serviceModalContent}>
            {/* Header */}
            <View style={styles.serviceModalHeader}>
              <View>
                <Text style={styles.serviceModalTitle}>სერვისის არჩევა</Text>
                <Text style={styles.serviceModalSubtitle}>აირჩიეთ სერვისი დაზიანებისთვის</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowServiceMenu(false);
                  setServiceSearchQuery('');
                  setSelectedCategory(null);
                }}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={COLORS.text.primary} />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.serviceSearchContainer}>
              <TextInput
                mode="outlined"
                placeholder="ძებნა..."
                value={serviceSearchQuery}
                onChangeText={setServiceSearchQuery}
                left={<TextInput.Icon icon="magnify" />}
                style={styles.serviceSearchInput}
                dense
              />
            </View>

            {/* Category Filter Tabs */}
            <FlatList
              data={getCategories()}
              renderItem={({ item: category }) => (
                <TouchableOpacity
                  style={[
                    styles.categoryTab,
                    selectedCategory === category && styles.categoryTabActive
                  ]}
                  onPress={() => setSelectedCategory(selectedCategory === category ? null : category)}
                >
                  <Text
                    style={[
                      styles.categoryTabText,
                      selectedCategory === category && styles.categoryTabTextActive
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item}
              horizontal
              scrollEnabled={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryTabsContainer}
              style={styles.categoryTabsList}
            />

            {/* Services List - Main Content */}
            <ScrollView 
              style={styles.servicesList}
              contentContainerStyle={styles.servicesListContent}
              scrollEnabled={true}
            >
              {(() => {
                const filtered = services.filter(service => {
                  // Filter by search query
                  if (serviceSearchQuery.trim()) {
                    const query = serviceSearchQuery.toLowerCase();
                    if (!service.nameKa.toLowerCase().includes(query) && !service.nameEn.toLowerCase().includes(query)) {
                      return false;
                    }
                  }
                  // Filter by category
                  if (selectedCategory && service.category !== selectedCategory) {
                    return false;
                  }
                  return true;
                });

                // Sort by sortOrder
                filtered.sort((a, b) => {
                  const orderA = a.sortOrder ?? 999;
                  const orderB = b.sortOrder ?? 999;
                  return orderA - orderB;
                });

                return filtered.length > 0 ? (
                  filtered.map((service) => (
                    <View
                      key={service.key}
                      style={styles.serviceItemPro}
                    >
                      <TouchableOpacity
                        style={styles.serviceItemTouchable}
                        onPress={() => handleServiceSelect(service)}
                        activeOpacity={0.7}
                      >
                                <View style={styles.serviceItemIconContainer}>
                                  <MaterialCommunityIcons
                                    name={service.icon as any}
                                    size={28}
                                    color={COLORS.primary}
                                  />
                                </View>
                                <View style={styles.serviceItemInfo}>
                                  <Text style={styles.serviceItemTitle}>{service.nameKa}</Text>
                                  {service.description && (
                                    <Text style={styles.serviceItemDescription}>{service.description}</Text>
                                  )}
                                </View>
                                <View style={styles.serviceItemPrice}>
                                  <Text style={styles.serviceItemPriceText}>
                                    {formatCurrencyGEL(service.basePrice)}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            </View>
                          ))
                        ) : (
                          <Text style={styles.noServicesText}>
                            {serviceSearchQuery ? 'სერვისი ვერ მოიძებნა' : 'სერვისები ჯერ არ დამატებულია'}
                          </Text>
                        );
              })()}
            </ScrollView>

            {/* Add Custom Service Button */}
            <View style={styles.customServiceButtonContainer}>
              <Button
                mode="contained"
                onPress={() => setShowCustomServiceModal(true)}
                icon="plus"
                style={styles.customServiceButtonPro}
                labelStyle={styles.customServiceButtonLabel}
              >
                ახალი სერვისი
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* Price Adjustment Modal */}
      <Portal>
        <Modal
          visible={priceAdjustmentVisible}
          onDismiss={() => setPriceAdjustmentVisible(false)}
          contentContainerStyle={styles.priceModal}
        >
          <Text style={styles.modalTitle}>ფასის კორექტირება</Text>
          <Text style={styles.modalSubtitle}>
            {editingTag?.serviceNameKa || editingTag?.serviceName}
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

          <Text style={styles.priceHint}>დააჭირეთ + ან - ფასის შესაცვლელად 0.5 ლარით</Text>

          {/* Quantity Adjustment */}
          <View style={styles.quantitySection}>
            <Text style={styles.quantityLabel}>რაოდენობა</Text>
            <View style={styles.quantityControl}>
              <TouchableOpacity
                style={[styles.quantityButton, tempQuantity <= 0.1 && styles.quantityButtonDisabled]}
                onPress={() => setTempQuantity(Math.max(0.1, Math.round((tempQuantity - 0.5) * 10) / 10))}
                disabled={tempQuantity <= 0.1}
              >
                <MaterialCommunityIcons 
                  name="minus" 
                  size={20} 
                  color={tempQuantity <= 0.1 ? COLORS.text.disabled : COLORS.primary} 
                />
              </TouchableOpacity>
              <TextInput
                mode="outlined"
                value={tempQuantity.toString()}
                onChangeText={(text) => {
                  const numValue = parseFloat(text.replace(/[^0-9.]/g, ''));
                  if (!isNaN(numValue) && numValue >= 0) {
                    setTempQuantity(numValue);
                  } else if (text === '' || text === '0') {
                    setTempQuantity(0);
                  }
                }}
                keyboardType="decimal-pad"
                style={{ width: 80, height: 44, textAlign: 'center' }}
                contentStyle={{ textAlign: 'center', paddingHorizontal: 0 }}
                dense
              />
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => setTempQuantity(Math.round((tempQuantity + 0.5) * 10) / 10)}
              >
                <MaterialCommunityIcons name="plus" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <TextInput
            mode="outlined"
            label="შეიყვანეთ ფასი ხელით"
            value={tempPrice.toString()}
            onChangeText={handleManualPriceChange}
            keyboardType="decimal-pad"
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
              წაშლა
            </Button>
            <Button
              mode="contained"
              onPress={confirmPriceChange}
              style={styles.confirmButton}
            >
              დადასტურება
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Custom Service Modal */}
      <Portal>
        <Modal
          visible={showCustomServiceModal}
          onDismiss={() => setShowCustomServiceModal(false)}
          contentContainerStyle={styles.customServiceModal}
        >
          {/* Header */}
          <View style={styles.customServiceHeader}>
            <View>
              <Text style={styles.customServiceTitle}>ახალი სერვისი</Text>
              <Text style={styles.customServiceSubtitle}>დაამატე ახალი სერვის</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowCustomServiceModal(false)}
              style={styles.closeButton}
            >
              <MaterialCommunityIcons name="close" size={24} color={COLORS.text.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.customServiceFormContainer}>
            {/* Icon Preview */}
            <View style={styles.customServiceIconPreview}>
              <MaterialCommunityIcons
                name="plus-circle"
                size={48}
                color={COLORS.primary}
              />
            </View>

            <TextInput
              mode="outlined"
              label="სერვისის სახელი (ქართული) *"
              value={customServiceNameKa}
              onChangeText={setCustomServiceNameKa}
              placeholder="მაგ: გაზეთის გაწმენდა"
              style={styles.customServiceInput}
              outlineColor={COLORS.outline}
              activeOutlineColor={COLORS.primary}
            />

            <TextInput
              mode="outlined"
              label="Service Name (English)"
              value={customServiceName}
              onChangeText={setCustomServiceName}
              placeholder="e.g., Glass Polishing"
              style={styles.customServiceInput}
              outlineColor={COLORS.outline}
              activeOutlineColor={COLORS.primary}
            />

            <TextInput
              mode="outlined"
              label="ფასი (GEL) *"
              value={customServicePrice}
              onChangeText={setCustomServicePrice}
              keyboardType="decimal-pad"
              placeholder="100"
              left={<TextInput.Affix text="₾" />}
              style={styles.customServiceInput}
              outlineColor={COLORS.outline}
              activeOutlineColor={COLORS.primary}
            />
          </View>

          <View style={styles.customServiceActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setCustomServiceName('');
                setCustomServiceNameKa('');
                setCustomServicePrice('');
                setShowCustomServiceModal(false);
              }}
              style={styles.cancelButton}
              labelStyle={styles.buttonLabel}
            >
              გაუქმება
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveCustomService}
              loading={savingCustomService}
              disabled={savingCustomService}
              style={styles.saveButtonPro}
              labelStyle={styles.buttonLabelPro}
            >
              დამატება
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
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: '600',
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
  tagDotContainer: {
    alignItems: 'center',
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
  tagQuantity: {
    color: COLORS.text.onPrimary,
    fontSize: 9,
    fontWeight: '400',
    marginTop: 1,
    opacity: 0.8,
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
  
  // Enhanced Service Modal Styles
  serviceModal: {
    backgroundColor: COLORS.background,
    margin: 0,
    height: '90%',
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  serviceModalContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  serviceModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
  },
  serviceModalTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  serviceModalSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  closeButton: {
    padding: SPACING.sm,
  },
  serviceSearchContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  serviceSearchInput: {
    borderRadius: BORDER_RADIUS.lg,
  },
  categoryTabsList: {
    maxHeight: 50,
  },
  categoryTabsContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  categoryTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 36,
    justifyContent: 'center',
  },
  categoryTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryTabText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
    color: COLORS.text.secondary,
    textTransform: 'capitalize',
  },
  categoryTabTextActive: {
    color: COLORS.text.onPrimary,
  },
  servicesList: {
    flex: 1,
  },
  servicesListContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  serviceCategoryHeader: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '700',
    color: COLORS.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  serviceItemPro: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  serviceItemReorderButtons: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
  },
  reorderButton: {
    padding: SPACING.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reorderButtonDisabled: {
    opacity: 0.4,
  },
  serviceItemIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  serviceItemTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceItemInfo: {
    flex: 1,
  },
  serviceItemTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  serviceItemDescription: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  serviceItemPrice: {
    alignItems: 'flex-end',
    marginLeft: SPACING.md,
  },
  serviceItemPriceText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '700',
    color: COLORS.primary,
  },
  customServiceButtonContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
    backgroundColor: COLORS.background,
  },
  customServiceButtonPro: {
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.sm,
  },
  customServiceButtonLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '600',
  },
  noServicesText: {
    textAlign: 'center',
    color: COLORS.text.secondary,
    fontSize: TYPOGRAPHY.fontSize.base,
    paddingVertical: SPACING.xl,
  },
  
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: '600',
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
  quantitySection: {
    marginBottom: SPACING.md,
  },
  quantityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.outline,
    alignSelf: 'center',
  },
  quantityButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityDisplay: {
    paddingHorizontal: SPACING.lg,
    minWidth: 60,
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.primary,
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
  customServiceModal: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    maxHeight: height * 0.85,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  customServiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
  },
  customServiceTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  customServiceSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  customServiceFormContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  customServiceIconPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: `${COLORS.primary}10`,
    marginBottom: SPACING.xl,
  },
  customServiceInput: {
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  customServiceActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  cancelButton: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
  },
  saveButton: {
    flex: 1,
  },
  saveButtonPro: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
  },
  buttonLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '600',
  },
  buttonLabelPro: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '600',
  },
});