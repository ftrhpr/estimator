import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    GestureHandlerRootView,
    PinchGestureHandler,
} from 'react-native-gesture-handler';
import {
    Button,
    Card,
    Divider,
    Menu,
    Modal,
    Portal,
    Text,
    TextInput,
} from 'react-native-paper';
import Animated, {
    useAnimatedGestureHandler,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

// Georgian service list
const SERVICES_GEORGIAN = [
  { id: 'painting', name: 'სამღებრო', nameEn: 'Painting', icon: 'format-paint', defaultPrice: 200 },
  { id: 'bodywork', name: 'თუნუქი', nameEn: 'Bodywork', icon: 'hammer', defaultPrice: 150 },
  { id: 'polishing', name: 'პოლირება', nameEn: 'Polishing', icon: 'auto-fix', defaultPrice: 100 },
  { id: 'disassembly', name: 'დაშლა-აწყობა', nameEn: 'Disassembly-Assembly', icon: 'tools', defaultPrice: 120 },
];

// Car Parts list
const CAR_PARTS = [
  'Front Bumper',
  'Rear Bumper',
  'Hood',
  'Front Fender (Left)',
  'Front Fender (Right)',
  'Front Door (Left)',
  'Front Door (Right)',
  'Rear Door (Left)',
  'Rear Door (Right)',
  'Roof',
  'Trunk',
  'Side Mirror (Left)',
  'Side Mirror (Right)',
  'Headlight (Left)',
  'Headlight (Right)',
  'Taillight (Left)',
  'Taillight (Right)',
  'Windshield',
  'Rear Window',
  'Quarter Panel (Left)',
  'Quarter Panel (Right)',
  'Other',
];

export default function ZoneEstimatorScreen({ route, navigation }) {
  const { photos = [], photoData = [] } = route.params || {};
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [damageData, setDamageData] = useState([]); // Store all damage data
  const [showModal, setShowModal] = useState(false);
  const [pendingPin, setPendingPin] = useState(null);
  const [selectedPart, setSelectedPart] = useState('');
  const [selectedServices, setSelectedServices] = useState([]);
  const [customPrices, setCustomPrices] = useState({});
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const [showPartMenu, setShowPartMenu] = useState(false);
  
  // Zoom animation values
  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  // Get current photo damage pins
  const getCurrentPhotoPins = () => {
    return damageData.filter(d => d.photoId === currentImageIndex);
  };

  const handleImagePress = (event) => {
    // Reset zoom when tapping to add pin
    scale.value = withSpring(1);
    
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
      x: Math.max(0, Math.min(100, xPercent)),
      y: Math.max(0, Math.min(100, yPercent)),
    });
    
    // Reset modal state
    setSelectedPart('');
    setSelectedServices([]);
    setCustomPrices({});
    setShowModal(true);
  };

  const handleImageLayout = (event) => {
    const { width: imgWidth, height: imgHeight, x, y } = event.nativeEvent.layout;
    setImageLayout({ width: imgWidth, height: imgHeight, x, y });
  };

  const toggleService = (service) => {
    if (selectedServices.find(s => s.id === service.id)) {
      setSelectedServices(selectedServices.filter(s => s.id !== service.id));
      const newPrices = { ...customPrices };
      delete newPrices[service.id];
      setCustomPrices(newPrices);
    } else {
      setSelectedServices([...selectedServices, service]);
      setCustomPrices({
        ...customPrices,
        [service.id]: service.defaultPrice.toString()
      });
    }
  };

  const updateServicePrice = (serviceId, price) => {
    setCustomPrices({
      ...customPrices,
      [serviceId]: price
    });
  };

  const handleSavePin = () => {
    if (!selectedPart) {
      Alert.alert('Error', 'Please select a car part');
      return;
    }

    if (selectedServices.length === 0) {
      Alert.alert('Error', 'Please select at least one service');
      return;
    }

    const services = selectedServices.map(service => ({
      name: service.name,
      nameEn: service.nameEn,
      price: parseFloat(customPrices[service.id]) || service.defaultPrice
    }));

    const newDamage = {
      id: Date.now(),
      photoId: currentImageIndex,
      x: pendingPin.x,
      y: pendingPin.y,
      part: selectedPart,
      services: services,
    };

    setDamageData([...damageData, newDamage]);
    setShowModal(false);
    setPendingPin(null);
  };

  const removePin = (damageId) => {
    Alert.alert(
      'Remove Damage Point',
      'Are you sure you want to remove this damage point?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setDamageData(damageData.filter(d => d.id !== damageId));
          }
        }
      ]
    );
  };

  const nextImage = () => {
    if (currentImageIndex < photos.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
      setImageLayout({ width: 0, height: 0, x: 0, y: 0 });
      scale.value = withSpring(1);
    }
  };

  const prevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
      setImageLayout({ width: 0, height: 0, x: 0, y: 0 });
      scale.value = withSpring(1);
    }
  };

  const getTotalPrice = () => {
    let total = 0;
    damageData.forEach(damage => {
      damage.services.forEach(service => {
        total += service.price;
      });
    });
    return total;
  };

  const proceedToInvoice = () => {
    if (damageData.length === 0) {
      Alert.alert(
        'No Damage Points',
        'Please add at least one damage point to continue.',
        [{ text: 'OK' }]
      );
      return;
    }

    navigation.navigate('Invoice', {
      photos: photos,
      photoData: photoData,
      damageData: damageData,
      totalPrice: getTotalPrice(),
    });
  };

  // Pinch gesture handler for zoom
  const onPinchEvent = useAnimatedGestureHandler({
    onStart: (_, ctx) => {
      ctx.startScale = scale.value;
    },
    onActive: (event, ctx) => {
      scale.value = ctx.startScale * event.scale;
      focalX.value = event.focalX;
      focalY.value = event.focalY;
    },
    onEnd: () => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
      } else if (scale.value > 3) {
        scale.value = withSpring(3);
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
      ],
    };
  });

  const renderPin = (damage, index) => {
    const pinNumber = getCurrentPhotoPins().findIndex(d => d.id === damage.id) + 1;
    
    return (
      <Pressable
        key={damage.id}
        style={[
          styles.pin,
          {
            left: `${damage.x}%`,
            top: `${damage.y}%`,
          }
        ]}
        onLongPress={() => removePin(damage.id)}
      >
        <View style={styles.pinBadge}>
          <Text style={styles.pinNumber}>{pinNumber}</Text>
        </View>
      </Pressable>
    );
  };

  if (photos.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="image-broken" size={64} color="#6b7280" />
        <Text style={styles.errorText}>No photos to assess</Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Go Back
        </Button>
      </View>
    );
  }

  const currentPhotoPins = getCurrentPhotoPins();

  return (
    <GestureHandlerRootView style={styles.container}>
      
      {/* Header with Navigation */}
      <View style={styles.header}>
        <Button
          mode="text"
          onPress={prevImage}
          disabled={currentImageIndex === 0}
          icon="chevron-left"
          compact
          textColor="#2563EB"
        >
          Prev
        </Button>
        
        <View style={styles.headerCenter}>
          <Text style={styles.imageCounter}>
            Photo {currentImageIndex + 1} of {photos.length}
          </Text>
          {photoData[currentImageIndex]?.label && (
            <Text style={styles.photoLabel}>
              {photoData[currentImageIndex].label}
            </Text>
          )}
        </View>
        
        <Button
          mode="text"
          onPress={nextImage}
          disabled={currentImageIndex === photos.length - 1}
          icon="chevron-right"
          compact
          contentStyle={{ flexDirection: 'row-reverse' }}
          textColor="#2563EB"
        >
          Next
        </Button>
      </View>

      {/* Main Image Area with Pinch Zoom */}
      <View style={styles.imageContainer}>
        <PinchGestureHandler onGestureEvent={onPinchEvent}>
          <Animated.View style={[styles.imageWrapper, animatedStyle]}>
            <Pressable onPress={handleImagePress} style={styles.imagePressable}>
              <Image
                source={{ uri: photos[currentImageIndex] }}
                style={styles.image}
                onLayout={handleImageLayout}
                resizeMode="contain"
              />
              
              {/* Render pins for current photo */}
              <View style={styles.pinsOverlay} pointerEvents="box-none">
                {currentPhotoPins.map((damage, index) => renderPin(damage, index))}
              </View>
            </Pressable>
          </Animated.View>
        </PinchGestureHandler>

        {/* Zoom hint */}
        <View style={styles.zoomHint}>
          <MaterialCommunityIcons name="gesture-pinch" size={16} color="white" />
          <Text style={styles.zoomHintText}>Pinch to zoom</Text>
        </View>
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <MaterialCommunityIcons name="information" size={16} color="#6b7280" />
        <Text style={styles.instructionsText}>
          Tap on damage areas to add pins • Long press to remove
        </Text>
      </View>

      {/* Bottom Stats and Action */}
      <View style={styles.bottomSection}>
        <Card style={styles.statsCard}>
          <Card.Content style={styles.statsContent}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="map-marker-multiple" size={24} color="#2563EB" />
              <Text style={styles.statValue}>{damageData.length}</Text>
              <Text style={styles.statLabel}>Damage Points</Text>
            </View>
            
            <Divider style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="cash-multiple" size={24} color="#10b981" />
              <Text style={styles.statValue}>₾{getTotalPrice()}</Text>
              <Text style={styles.statLabel}>Total Estimate</Text>
            </View>
            
            <Button
              mode="contained"
              onPress={proceedToInvoice}
              disabled={damageData.length === 0}
              style={styles.continueButton}
              buttonColor="#2563EB"
              icon="file-document"
            >
              Generate Invoice
            </Button>
          </Card.Content>
        </Card>
      </View>

      {/* Damage Pin Modal */}
      <Portal>
        <Modal
          visible={showModal}
          onDismiss={() => setShowModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>Add Damage Point</Text>
            
            {/* Car Part Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Car Part</Text>
              <Menu
                visible={showPartMenu}
                onDismiss={() => setShowPartMenu(false)}
                anchor={
                  <TouchableOpacity
                    style={styles.partSelector}
                    onPress={() => setShowPartMenu(true)}
                  >
                    <MaterialCommunityIcons name="car-side" size={20} color="#6b7280" />
                    <Text style={[styles.partSelectorText, !selectedPart && styles.partSelectorPlaceholder]}>
                      {selectedPart || 'Select car part...'}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={20} color="#6b7280" />
                  </TouchableOpacity>
                }
              >
                <ScrollView style={styles.partMenu}>
                  {CAR_PARTS.map(part => (
                    <Menu.Item
                      key={part}
                      onPress={() => {
                        setSelectedPart(part);
                        setShowPartMenu(false);
                      }}
                      title={part}
                      leadingIcon={selectedPart === part ? 'check' : undefined}
                    />
                  ))}
                </ScrollView>
              </Menu>
            </View>

            {/* Service Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Services (Georgian)</Text>
              <View style={styles.servicesGrid}>
                {SERVICES_GEORGIAN.map(service => {
                  const isSelected = selectedServices.find(s => s.id === service.id);
                  return (
                    <TouchableOpacity
                      key={service.id}
                      style={[
                        styles.serviceCard,
                        isSelected && styles.serviceCardSelected
                      ]}
                      onPress={() => toggleService(service)}
                    >
                      <View style={styles.serviceCardHeader}>
                        <MaterialCommunityIcons 
                          name={service.icon} 
                          size={24} 
                          color={isSelected ? '#2563EB' : '#6b7280'} 
                        />
                        {isSelected && (
                          <MaterialCommunityIcons 
                            name="check-circle" 
                            size={16} 
                            color="#10b981" 
                          />
                        )}
                      </View>
                      <Text style={styles.serviceNameGeorgian}>{service.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Price Inputs for Selected Services */}
            {selectedServices.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Service Prices</Text>
                {selectedServices.map(service => (
                  <View key={service.id} style={styles.priceRow}>
                    <Text style={styles.priceLabel}>
                      {service.name}
                    </Text>
                    <TextInput
                      mode="outlined"
                      value={customPrices[service.id]}
                      onChangeText={(text) => updateServicePrice(service.id, text)}
                      keyboardType="numeric"
                      placeholder="Price"
                      style={styles.priceInput}
                      dense
                      left={<TextInput.Affix text="₾" />}
                    />
                  </View>
                ))}
              </View>
            )}

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setShowModal(false)}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSavePin}
                disabled={!selectedPart || selectedServices.length === 0}
                style={[styles.modalButton, styles.modalButtonPrimary]}
                buttonColor="#2563EB"
              >
                Add Pin
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f9fafb',
  },
  errorText: {
    fontSize: 18,
    color: '#374151',
    marginVertical: 16,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    elevation: 2,
  },
  headerCenter: {
    alignItems: 'center',
  },
  imageCounter: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  photoLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  
  // Image Container
  imageContainer: {
    flex: 1,
    backgroundColor: '#000',
    margin: 12,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
  },
  imageWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
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
  },
  
  // Pin Badge
  pin: {
    position: 'absolute',
    width: 36,
    height: 36,
    transform: [{ translateX: -18 }, { translateY: -18 }],
    pointerEvents: 'auto',
  },
  pinBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ef4444',
    borderWidth: 3,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  pinNumber: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Zoom Hint
  zoomHint: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  zoomHintText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 6,
  },
  
  // Instructions
  instructionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    gap: 8,
  },
  instructionsText: {
    fontSize: 13,
    color: '#6b7280',
  },
  
  // Bottom Section
  bottomSection: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  statsCard: {
    elevation: 0,
    backgroundColor: 'transparent',
  },
  statsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 50,
    marginHorizontal: 12,
  },
  continueButton: {
    flex: 1.5,
    marginLeft: 12,
  },
  
  // Modal
  modalContainer: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 16,
    padding: 24,
    maxHeight: height * 0.85,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 20,
  },
  
  // Section
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Part Selector
  partSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
  },
  partSelectorText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: '#111827',
  },
  partSelectorPlaceholder: {
    color: '#9ca3af',
  },
  partMenu: {
    maxHeight: 300,
  },
  
  // Services Grid
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceCard: {
    width: (width - 80) / 2,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: 'white',
  },
  serviceCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#eff6ff',
  },
  serviceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceNameGeorgian: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  serviceNameEn: {
    fontSize: 12,
    color: '#6b7280',
  },
  
  // Price Inputs
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  priceInput: {
    width: 120,
    marginLeft: 12,
  },
  
  // Modal Actions
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
  },
  modalButtonPrimary: {
    elevation: 2,
  },
});
