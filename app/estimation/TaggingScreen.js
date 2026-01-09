import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Image,
  Pressable,
  Alert,
} from 'react-native';
import {
  Appbar,
  Text,
  Button,
  Portal,
  Modal,
  TextInput,
  Chip,
  Card,
  ActivityIndicator,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

const { width, height } = Dimensions.get('window');

// Service types for damage tagging
const SERVICE_TYPES = [
  { id: 'painting', label: 'Painting', icon: 'format-paint', color: '#ef4444' },
  { id: 'dent_repair', label: 'Dent Repair', icon: 'hammer', color: '#f59e0b' },
  { id: 'scratch_repair', label: 'Scratch Repair', icon: 'auto-fix', color: '#8b5cf6' },
  { id: 'bumper_repair', label: 'Bumper Repair', icon: 'car-back', color: '#06b6d4' },
  { id: 'panel_replacement', label: 'Panel Replacement', icon: 'car-door', color: '#10b981' },
  { id: 'glass_repair', label: 'Glass Repair', icon: 'window-closed-variant', color: '#3b82f6' },
  { id: 'other', label: 'Other', icon: 'tools', color: '#6b7280' },
];

export default function TaggingScreen() {
  const params = useLocalSearchParams();
  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [pins, setPins] = useState({}); // Store pins per image: { imageIndex: [...pins] }
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [pendingPin, setPendingPin] = useState(null); // Temporary pin data
  const [selectedService, setSelectedService] = useState(null);
  const [priceInput, setPriceInput] = useState('0');
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.images) {
      try {
        const imageURIs = JSON.parse(params.images);
        setImages(imageURIs);
        // Initialize pins object for each image
        const initialPins = {};
        imageURIs.forEach((_, index) => {
          initialPins[index] = [];
        });
        setPins(initialPins);
        setLoading(false);
      } catch (error) {
        console.error('Error parsing images:', error);
        Alert.alert('Error', 'Failed to load images');
        router.back();
      }
    }
  }, [params.images]);

  const handleImagePress = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    
    // Ensure we have image layout dimensions
    if (imageLayout.width === 0 || imageLayout.height === 0) {
      Alert.alert('Error', 'Image not ready. Please wait and try again.');
      return;
    }
    
    // Convert coordinates to percentages relative to the actual rendered image
    const xPercent = (locationX / imageLayout.width) * 100;
    const yPercent = (locationY / imageLayout.height) * 100;
    
    // Store pending pin data with clamping
    setPendingPin({
      x: Math.max(0, Math.min(100, xPercent)), // Clamp between 0-100%
      y: Math.max(0, Math.min(100, yPercent)), // Clamp between 0-100%
    });
    
    // Reset modal state
    setSelectedService(null);
    setPriceInput('0');
    setShowServiceModal(true);
  };

  const handleImageLayout = (event) => {
    const { width: imgWidth, height: imgHeight, x, y } = event.nativeEvent.layout;
    setImageLayout({ width: imgWidth, height: imgHeight, x, y });
  };

  const handleServiceSelect = (service) => {
    setSelectedService(service);
  };

  const handleSavePin = () => {
    if (!selectedService || !pendingPin) {
      Alert.alert('Error', 'Please select a service type');
      return;
    }

    const price = parseFloat(priceInput) || 0;
    const newPin = {
      id: Date.now(),
      x: pendingPin.x,
      y: pendingPin.y,
      service: selectedService.id,
      serviceLabel: selectedService.label,
      price: price,
      color: selectedService.color,
      icon: selectedService.icon,
    };

    setPins(prevPins => ({
      ...prevPins,
      [currentImageIndex]: [...(prevPins[currentImageIndex] || []), newPin]
    }));

    setShowServiceModal(false);
    setPendingPin(null);
    setSelectedService(null);
  };

  const removePin = (pinId) => {
    setPins(prevPins => ({
      ...prevPins,
      [currentImageIndex]: prevPins[currentImageIndex].filter(pin => pin.id !== pinId)
    }));
  };

  const nextImage = () => {
    if (currentImageIndex < images.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
      // Reset image layout for new image
      setImageLayout({ width: 0, height: 0, x: 0, y: 0 });
    }
  };

  const prevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
      // Reset image layout for new image
      setImageLayout({ width: 0, height: 0, x: 0, y: 0 });
    }
  };

  const getTotalPrice = () => {
    let total = 0;
    Object.values(pins).forEach(imagePins => {
      imagePins.forEach(pin => {
        total += pin.price;
      });
    });
    return total;
  };

  const getTotalPins = () => {
    let total = 0;
    Object.values(pins).forEach(imagePins => {
      total += imagePins.length;
    });
    return total;
  };

  const proceedToSummary = () => {
    const summaryData = {
      images: images,
      pins: pins,
      totalPrice: getTotalPrice(),
      totalPins: getTotalPins(),
    };

    router.push({
      pathname: '/estimation/SummaryScreen',
      params: {
        data: JSON.stringify(summaryData)
      }
    });
  };

  const renderPin = (pin) => {
    return (
      <Pressable
        key={pin.id}
        style={[
          styles.pin,
          {
            left: `${pin.x}%`,
            top: `${pin.y}%`,
            backgroundColor: pin.color,
          }
        ]}
        onLongPress={() => {
          Alert.alert(
            'Remove Pin',
            `Remove ${pin.serviceLabel} (₾${pin.price})?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => removePin(pin.id) },
            ]
          );
        }}
      >
        <MaterialCommunityIcons 
          name={pin.icon} 
          size={14} 
          color="white" 
        />
        <Text style={styles.pinPrice}>₾{pin.price}</Text>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading images...</Text>
      </View>
    );
  }

  if (images.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="image-broken" size={64} color="#6b7280" />
        <Text style={styles.errorText}>No images to tag</Text>
        <Button mode="contained" onPress={() => router.back()}>
          Go Back
        </Button>
      </View>
    );
  }

  const currentImagePins = pins[currentImageIndex] || [];

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content 
          title={`Tag Damage (${currentImageIndex + 1}/${images.length})`} 
        />
        <Appbar.Action 
          icon="information-outline" 
          onPress={() => Alert.alert('Instructions', 'Tap on damage areas to add service pins. Long press pins to remove them.')} 
        />
      </Appbar.Header>

      {/* Image Navigation */}
      <View style={styles.navigationBar}>
        <Button
          mode="outlined"
          onPress={prevImage}
          disabled={currentImageIndex === 0}
          icon="chevron-left"
          compact
        >
          Previous
        </Button>
        
        <Text style={styles.imageCounter}>
          {currentImageIndex + 1} of {images.length}
        </Text>
        
        <Button
          mode="outlined"
          onPress={nextImage}
          disabled={currentImageIndex === images.length - 1}
          icon="chevron-right"
          compact
        >
          Next
        </Button>
      </View>

      {/* Main Image Area */}
      <View style={styles.imageContainer}>
        <View style={styles.imageWrapper}>
          <Pressable onPress={handleImagePress} style={styles.imagePressable}>
            <Image
              source={{ uri: images[currentImageIndex] }}
              style={styles.image}
              onLayout={handleImageLayout}
              resizeMode="contain"
            />
            
            {/* Render pins for current image */}
            <View style={styles.pinsOverlay}>
              {currentImagePins.map(renderPin)}
            </View>
          </Pressable>
        </View>
      </View>

      {/* Bottom Stats */}
      <View style={styles.bottomStats}>
        <Card style={styles.statsCard}>
          <Card.Content style={styles.statsContent}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="map-marker" size={20} color="#2563EB" />
              <Text style={styles.statValue}>{getTotalPins()}</Text>
              <Text style={styles.statLabel}>Pins</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="currency-usd" size={20} color="#10b981" />
              <Text style={styles.statValue}>₾{getTotalPrice()}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <Button
              mode="contained"
              onPress={proceedToSummary}
              style={styles.nextButton}
              disabled={getTotalPins() === 0}
              buttonColor="#2563EB"
            >
              Continue
            </Button>
          </Card.Content>
        </Card>
      </View>

      {/* Service Selection Modal */}
      <Portal>
        <Modal
          visible={showServiceModal}
          onDismiss={() => setShowServiceModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>Select Service Type</Text>
          <Text style={styles.modalSubtitle}>Choose the type of damage repair needed</Text>

          <View style={styles.serviceChips}>
            {SERVICE_TYPES.map((service) => (
              <Chip
                key={service.id}
                mode={selectedService?.id === service.id ? 'flat' : 'outlined'}
                selected={selectedService?.id === service.id}
                onPress={() => handleServiceSelect(service)}
                icon={service.icon}
                style={[
                  styles.serviceChip,
                  selectedService?.id === service.id && {
                    backgroundColor: service.color + '20',
                    borderColor: service.color,
                  }
                ]}
                textStyle={{
                  color: selectedService?.id === service.id ? service.color : '#374151'
                }}
              >
                {service.label}
              </Chip>
            ))}
          </View>

          {selectedService && (
            <View style={styles.priceSection}>
              <Text style={styles.priceLabel}>Estimated Price (₾)</Text>
              <TextInput
                mode="outlined"
                value={priceInput}
                onChangeText={setPriceInput}
                keyboardType="numeric"
                placeholder="Enter price"
                style={styles.priceInput}
              />
            </View>
          )}

          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => setShowServiceModal(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSavePin}
              disabled={!selectedService}
              style={styles.modalButton}
              buttonColor="#2563EB"
            >
              Add Pin
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2563EB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#374151',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    color: '#374151',
    marginVertical: 16,
  },
  navigationBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  imageCounter: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    margin: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  imageWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePressable: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  pinsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  pin: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -16 }, { translateY: -16 }],
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    pointerEvents: 'auto',
  },
  pinPrice: {
    position: 'absolute',
    bottom: -20,
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    minWidth: 30,
    textAlign: 'center',
  },
  bottomStats: {
    padding: 16,
  },
  statsCard: {
    elevation: 4,
  },
  statsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
  },
  nextButton: {
    flex: 2,
    marginLeft: 16,
  },
  modalContainer: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 24,
    maxHeight: height * 0.8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  serviceChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  serviceChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  priceSection: {
    marginBottom: 24,
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  priceInput: {
    backgroundColor: 'white',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
});