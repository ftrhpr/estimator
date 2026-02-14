import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useLayoutEffect, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    Linking,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import {
    ActivityIndicator,
    Button,
    Chip,
    Divider,
    IconButton,
    List,
    Modal,
    Portal,
    Text,
    TextInput,
} from 'react-native-paper';

import { CarSelector, SelectedCar } from '../../src/components/common/CarSelector';
import { BORDER_RADIUS, COLORS, SHADOWS, SPACING, TYPOGRAPHY } from '../../src/config/constants';
import { createInspection, getAllInspections } from '../../src/services/firebase';
import { PartsService } from '../../src/services/partsService';
import { StorageService } from '../../src/services/storageService';
import { formatCurrencyGEL } from '../../src/utils/helpers';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44;

const { width } = Dimensions.get('window');

export const options = () => ({ title: 'შეფასების შეჯამება' });

interface EstimateItem {
  id: string;
  serviceName: string;
  serviceNameKa?: string;
  description?: string;
  price: number;
  count?: number;
  photoAngle?: string;
  photoUri?: string;
}

interface CustomerInfo {
  name?: string;
  phone: string;
  isRepeat: boolean;
}

interface Part {
  id: string;
  name: string;
  nameKa?: string;
  partNumber?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export default function EstimateSummaryScreen() {
  const params = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();
  
  const [estimateItems, setEstimateItems] = useState<EstimateItem[]>([]);
  const [photosData, setPhotosData] = useState<any[]>([]);
  const [partsData, setPartsData] = useState<any[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    phone: '',
    isRepeat: false,
  });
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [carMake, setCarMake] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carMakeId, setCarMakeId] = useState('');
  const [carModelId, setCarModelId] = useState('');
  const [plate, setPlate] = useState('');
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [jobStarted, setJobStarted] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [invoiceSaved, setInvoiceSaved] = useState(false);
  
  // Parts state
  const [parts, setParts] = useState<Part[]>([]);
  const [showPartsModal, setShowPartsModal] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [partName, setPartName] = useState('');
  const [partNameKa, setPartNameKa] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [partQuantity, setPartQuantity] = useState('1');
  const [partUnitPrice, setPartUnitPrice] = useState('');
  const [partNotes, setPartNotes] = useState('');
  
  // Discounts state
  const [servicesDiscount, setServicesDiscount] = useState('0');
  const [partsDiscount, setPartsDiscount] = useState('0');
  const [globalDiscount, setGlobalDiscount] = useState('0');

  // VAT state
  const [includeVAT, setIncludeVAT] = useState(false);
  const VAT_RATE = 0.18; // 18% VAT
  
  const cameraRef = useRef<CameraView>(null);

  // Initialize estimate data from params
  React.useEffect(() => {
    const setMockEstimateData = () => {
      const mockItems: EstimateItem[] = [
        {
          id: '1',
          serviceName: 'Painting',
          price: 250,
          photoAngle: 'Side',
          photoUri: 'https://via.placeholder.com/100x80/E2E8F0/475569?text=Side',
        },
        {
          id: '2',
          serviceName: 'Dent Repair',
          price: 120,
          photoAngle: 'Damage Close-up',
          photoUri: 'https://via.placeholder.com/100x80/E2E8F0/475569?text=Damage',
        },
        {
          id: '3',
          serviceName: 'Polishing',
          price: 80,
          photoAngle: 'Front',
          photoUri: 'https://via.placeholder.com/100x80/E2E8F0/475569?text=Front',
        },
      ];
      setEstimateItems(mockItems);
      console.log('Using mock estimate data:', mockItems);
    };

    if (params.estimateData) {
      try {
        const data = JSON.parse(params.estimateData as string);
        console.log('Parsed estimateData from params:', data);
        const items = data.items || [];
        console.log('Items loaded:', items);
        setEstimateItems(items);
        setPhotosData(data.photos || []);
        setPartsData(data.parts || []);

        // Load inventory parts if available - ensure each part has an ID and required fields
        // NOTE: data.parts from PhotoTaggingScreen contains damage tagging data (partName, damages),
        // NOT inventory parts. Only load as inventory parts if they have the correct structure.
        if (Array.isArray(data.parts)) {
          const inventoryParts = data.parts.filter((p: any) =>
            (p.unitPrice !== undefined || p.unit_price !== undefined || p.name !== undefined) &&
            !p.damages && !p.partName
          );

          if (inventoryParts.length > 0) {
            const partsWithIds = inventoryParts.map((p: any, idx: number) => ({
              id: p.id || `loaded-part-${idx}-${Date.now()}`,
              name: p.name || p.nameKa || 'Unnamed Part',
              nameKa: p.nameKa || '',
              partNumber: p.partNumber || p.part_number || '',
              quantity: p.quantity || 1,
              unitPrice: p.unitPrice || p.unit_price || 0,
              totalPrice: p.totalPrice || p.total_price || (p.quantity || 1) * (p.unitPrice || p.unit_price || 0),
              notes: p.notes || '',
            }));
            setParts(partsWithIds);
          }
        }
      } catch (error) {
        console.error('Error parsing estimate data:', error);
        // Mock data for demo
        setMockEstimateData();
      }
    } else {
      console.log('No estimateData in params, using mock data');
      setMockEstimateData();
    }
  }, [params.estimateData]);

  const navigation = useNavigation();
  useLayoutEffect(() => {
    const title = customerName || plate || 'შეფასების შეჯამება';
    const itemCount = estimateItems?.length ? ` (${estimateItems.length})` : '';
    navigation.setOptions({ title: `${title}${itemCount}` });
  }, [customerName, plate, estimateItems, navigation]);

  const getServicesTotal = () => {
    const subtotal = estimateItems.reduce((total, item) => total + item.price, 0);
    const discount = (parseFloat(servicesDiscount) || 0) / 100;
    return Math.max(0, subtotal - (subtotal * discount));
  };

  const getPartsTotal = () => {
    const subtotal = parts.reduce((total, part) => total + part.totalPrice, 0);
    const discount = (parseFloat(partsDiscount) || 0) / 100;
    return Math.max(0, subtotal - (subtotal * discount));
  };

  const getSubtotalAfterDiscounts = () => {
    const subtotal = getServicesTotal() + getPartsTotal();
    const globalDiscountPercent = (parseFloat(globalDiscount) || 0) / 100;
    return Math.max(0, subtotal - (subtotal * globalDiscountPercent));
  };

  const getVATAmount = () => {
    if (!includeVAT) return 0;
    return getSubtotalAfterDiscounts() * VAT_RATE;
  };

  const getTotalPrice = () => {
    return getSubtotalAfterDiscounts() + getVATAmount();
  };

  // Parts management functions
  const openAddPartModal = () => {
    setEditingPart(null);
    setPartName('');
    setPartNameKa('');
    setPartNumber('');
    setPartQuantity('1');
    setPartUnitPrice('');
    setPartNotes('');
    setShowPartsModal(true);
  };

  const openEditPartModal = (part: Part) => {
    setEditingPart(part);
    setPartName(part.name);
    setPartNameKa(part.nameKa || '');
    setPartNumber(part.partNumber || '');
    setPartQuantity(String(part.quantity));
    setPartUnitPrice(String(part.unitPrice));
    setPartNotes(part.notes || '');
    setShowPartsModal(true);
  };

  const handleSavePart = async () => {
    const quantity = parseInt(partQuantity) || 1;
    const unitPrice = parseFloat(partUnitPrice) || 0;
    const totalPrice = quantity * unitPrice;

    if (!partName.trim() && !partNameKa.trim()) {
      Alert.alert('შეცდომა', 'გთხოვთ შეიყვანოთ ნაწილის სახელი');
      return;
    }

    if (unitPrice <= 0) {
      Alert.alert('შეცდომა', 'გთხოვთ შეიყვანოთ ფასი');
      return;
    }

    const newPart: Part = {
      id: editingPart?.id || Date.now().toString(),
      name: partName.trim() || partNameKa.trim(),
      nameKa: partNameKa.trim(),
      partNumber: partNumber.trim(),
      quantity,
      unitPrice,
      totalPrice,
      notes: partNotes.trim(),
    };

    // Save to featured parts database if this is a new part with Georgian name
    if (!editingPart && partNameKa.trim()) {
      try {
        // Check if part already exists
        const exists = await PartsService.partExists(partNameKa.trim());
        if (!exists) {
          await PartsService.addPart({
            nameKa: partNameKa.trim(),
            nameEn: partName.trim() || undefined,
            name: partName.trim() || partNameKa.trim(),
          });
          console.log('[EstimateSummary] Part saved to featured parts database');
        }
      } catch (error) {
        console.error('[EstimateSummary] Error saving part to database:', error);
        // Don't block part addition if database save fails
      }
    }

    if (editingPart) {
      setParts(parts.map(p => p.id === editingPart.id ? newPart : p));
    } else {
      setParts([...parts, newPart]);
    }

    // Reset form
    setEditingPart(null);
    setPartName('');
    setPartNameKa('');
    setPartNumber('');
    setPartQuantity('1');
    setPartUnitPrice('');
    setPartNotes('');
    setShowPartsModal(false);
  };

  const handleDeletePart = (partId: string) => {
    Alert.alert(
      'წაშლა',
      'ნამდვილად გსურთ ნაწილის წაშლა?',
      [
        { text: 'გაუქმება', style: 'cancel' },
        { text: 'წაშლა', style: 'destructive', onPress: () => {
          setParts(parts.filter(p => p.id !== partId));
        }},
      ]
    );
  };

  // Group estimate items by service name for display
  // Items may already be grouped (have count > 1) from PhotoTaggingScreen
  const getGroupedEstimateItems = () => {
    const grouped = new Map<string, EstimateItem & { count: number }>();
    
    estimateItems.forEach(item => {
      // Use Georgian name if available, otherwise English name for grouping
      const key = item.serviceNameKa || item.serviceName;
      const itemCount = item.count || 1;
      
      if (grouped.has(key)) {
        const existing = grouped.get(key)!;
        existing.count += itemCount;
        existing.price += item.price;
      } else {
        grouped.set(key, { ...item, count: itemCount });
      }
    });
    
    console.log('Grouped estimate items:', Array.from(grouped.entries()));
    return Array.from(grouped.values());
  };

  const searchCustomerByPhone = async (phone: string) => {
    try {
      setSearchingCustomer(true);
      const cleanPhone = phone.replace(/\s/g, '');
      const inspections = await getAllInspections();
      
      // Find the most recent inspection for this phone number
      const customerInspections = inspections.filter(
        (inv: any) => inv.customerPhone && inv.customerPhone.replace(/\s/g, '') === cleanPhone
      );
      
      if (customerInspections.length > 0) {
        // Sort by date to get most recent
        const sortedInspections = customerInspections.sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        const recentCustomer = sortedInspections[0];
        setCustomerName(recentCustomer.customerName || '');
        setCarMake(recentCustomer.carMake || '');
        setCarModel(recentCustomer.carModel || '');
        setCarMakeId(recentCustomer.carMakeId || '');
        setCarModelId(recentCustomer.carModelId || '');
        setPlate(recentCustomer.plate || '');

        // Show a notification that customer was found
        const carInfo = [recentCustomer.carMake, recentCustomer.carModel].filter(Boolean).join(' ');
        Alert.alert(
          'კლიენტი ნაპოვნია',
          `მოგესალმებით ${recentCustomer.customerName || 'კლიენტი'}!\n${carInfo ? `ავტო: ${carInfo}\n` : ''}ნომერი: ${recentCustomer.plate || 'არ არის მითითებული'}`,
          [{ text: 'OK' }]
        );
        
        return true;
      }
      
      // New customer
      setCustomerName('');
      setCarMake('');
      setCarModel('');
      setCarMakeId('');
      setCarModelId('');
      return false;
    } catch (error) {
      console.error('Error searching customer:', error);
      return false;
    } finally {
      setSearchingCustomer(false);
    }
  };

  // Search customer when phone number is entered
  React.useEffect(() => {
    const georgianPhoneRegex = /^(\+995|995)?[0-9]{9}$/;
    const cleanPhone = phoneNumber.replace(/\s/g, '');
    
    if (cleanPhone.length >= 9 && georgianPhoneRegex.test(cleanPhone)) {
      const timeoutId = setTimeout(() => {
        searchCustomerByPhone(cleanPhone);
      }, 500); // Debounce 500ms
      
      return () => clearTimeout(timeoutId);
    }
  }, [phoneNumber]);

  const handlePhoneSubmit = () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Phone Required', 'Please enter customer phone number');
      return;
    }

    // Validate Georgian phone number format
    const georgianPhoneRegex = /^(\+995|995)?[0-9]{9}$/;
    if (!georgianPhoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      Alert.alert('Invalid Phone', 'Please enter a valid Georgian phone number');
      return;
    }

    setCustomerInfo({
      name: customerName.trim() || undefined,
      phone: phoneNumber,
      isRepeat: false,
    });
    setShowCustomerModal(false);
  };

  const handleQRScan = async () => {
    if (!permission?.granted) {
      await requestPermission();
    }
    setShowQRScanner(true);
  };

  const handleQRCodeScanned = ({ data }: { data: string }) => {
    setShowQRScanner(false);
    
    try {
      // Parse customer QR data (would be JSON with customer info)
      const customerData = JSON.parse(data);
      setCustomerInfo({
        name: customerData.name,
        phone: customerData.phone,
        isRepeat: true,
      });
      setPhoneNumber(customerData.phone);
    } catch (error) {
      // Fallback: treat as phone number
      setPhoneNumber(data);
      setCustomerInfo({
        phone: data,
        isRepeat: true,
      });
    }
  };

  const generateAndSendPDF = async () => {
    if (!customerInfo.phone) {
      setShowCustomerModal(true);
      return;
    }

    try {
      setIsGeneratingPDF(true);
      
      // Simulate PDF generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const totalPrice = getTotalPrice();
      const itemCount = estimateItems.length;
      
      // Create WhatsApp message
      const message = `🚗 Auto Body Estimate\n\n` +
        `📋 Services: ${itemCount} items\n` +
        `💰 Total: ${formatCurrencyGEL(totalPrice)}\n\n` +
        `Services:\n` +
        estimateItems.map(item => `• ${item.serviceName} - ${formatCurrencyGEL(item.price)}`).join('\n') +
        `\n\n📄 Detailed PDF with photos attached.\n\n` +
        `Thank you for choosing our auto body services! 🔧`;

      // Format phone number for WhatsApp
      const cleanPhone = customerInfo.phone.replace(/\D/g, '');
      const whatsappPhone = cleanPhone.startsWith('995') ? cleanPhone : `995${cleanPhone}`;
      
      const whatsappUrl = `whatsapp://send?phone=${whatsappPhone}&text=${encodeURIComponent(message)}`;
      
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        Alert.alert('WhatsApp არ არის', 'გთხოვთ დააყენოთ WhatsApp შეფასებების გასაგზავნად');
      }
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('შეცდომა', 'შეფასების გენერირება ვერ მოხერხდა. სცადეთ თავიდან.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const saveInvoice = async () => {
    if (!customerInfo.phone) {
      Alert.alert(
        'კლიენტის ინფორმაცია',
        'გთხოვთ დაამატოთ კლიენტის ტელეფონის ნომერი',
        [{ text: 'დამატება', onPress: () => setShowCustomerModal(true) }]
      );
      return;
    }

    try {
      setIsSaving(true);
      
      // Upload photos to Firebase Storage first
      console.log('Uploading photos to Firebase Storage...');
      let uploadedPhotos: any[] = [];
      if (photosData && photosData.length > 0) {
        for (let i = 0; i < photosData.length; i++) {
          const photo = photosData[i];
          // Check if this is a local file URI that needs uploading
          if (photo.url && (photo.url.startsWith('file://') || photo.url.startsWith('content://'))) {
            try {
              console.log(`Uploading photo ${i + 1}/${photosData.length}...`);
              const downloadUrl = await StorageService.uploadEstimatePhoto(photo.url);
              uploadedPhotos.push({
                ...photo,
                url: downloadUrl,
                localUri: photo.url, // Keep original local URI as backup
              });
              console.log(`Photo ${i + 1} uploaded successfully`);
            } catch (uploadError) {
              console.error(`Failed to upload photo ${i + 1}:`, uploadError);
              // Keep local URI if upload fails
              uploadedPhotos.push(photo);
            }
          } else {
            // Already a remote URL, keep as-is
            uploadedPhotos.push(photo);
          }
        }
        console.log('All photos processed. Uploaded:', uploadedPhotos.length);
      }
      
      // Prepare combined services array from estimate items
      // Items already come grouped from PhotoTaggingScreen with count field
      const serviceMap = new Map<string, { serviceName: string; serviceNameKa: string; description: string; price: number; count: number; notes: string }>();
      
      estimateItems.forEach(item => {
        // Use Georgian name as key if available for proper grouping
        const key = item.serviceNameKa || item.serviceName;
        const itemCount = item.count || 1;
        
        if (serviceMap.has(key)) {
          const existing = serviceMap.get(key)!;
          existing.count += itemCount;
          existing.price += item.price;
        } else {
          serviceMap.set(key, {
            serviceName: item.serviceName,
            serviceNameKa: item.serviceNameKa || '',
            description: item.serviceName,
            price: item.price,
            count: itemCount,
            notes: item.photoAngle ? `Tagged on photo: ${item.photoAngle}` : '',
          });
        }
      });
      
      const allServices = Array.from(serviceMap.values());
      
      console.log('EstimateItems for services:', estimateItems);
      console.log('Final grouped services:', allServices);
      console.log('Parts data:', parts);

      // Prepare parts data for sync - transform to match cPanel expected format
      const partsForSync = parts.map(part => ({
        name: part.name,
        nameKa: part.nameKa || '',
        partNumber: part.partNumber || '',
        quantity: part.quantity,
        unitPrice: part.unitPrice,
        totalPrice: part.totalPrice,
        notes: part.notes || '',
      }));

      // Prepare invoice data with uploaded photo URLs
      // partsData contains damage tagging info (partName, damages with photoIndex)
      // partsForSync contains inventory parts (name, quantity, unitPrice)
      const invoiceData = {
        customerName: customerInfo.name || customerName || 'N/A',
        customerPhone: customerInfo.phone,
        carMake: carMake || '',
        carModel: carModel || '',
        carMakeId: carMakeId || '',
        carModelId: carModelId || '',
        plate: plate || 'N/A',
        totalPrice: getTotalPrice(),
        servicesTotal: getServicesTotal(),
        partsTotal: getPartsTotal(),
        services: allServices,
        photos: uploadedPhotos.length > 0 ? uploadedPhotos : photosData,
        parts: partsData,
        inventoryParts: partsForSync,
        // Discounts
        services_discount_percent: parseFloat(servicesDiscount) || 0,
        parts_discount_percent: parseFloat(partsDiscount) || 0,
        global_discount_percent: parseFloat(globalDiscount) || 0,
        // VAT
        includeVAT: includeVAT,
        vatRate: includeVAT ? VAT_RATE : 0,
        vatAmount: getVATAmount(),
        subtotalBeforeVAT: getSubtotalAfterDiscounts(),
        status: 'Pending',
        isRepeatCustomer: customerInfo.isRepeat,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      console.log('Complete invoice data being saved:', invoiceData);

      // Save to Firestore (using createInspection from firebase service)
      const docId = await createInspection(invoiceData);

      setInvoiceSaved(true);
      Alert.alert(
        '✅ შენახულია!',
        `საქმე #${docId.slice(0, 8).toUpperCase()} წარმატებით შეინახა.`,
        [
          { text: 'საქმეების ნახვა', onPress: () => router.push('/(tabs)/cases') },
          { text: 'კარგი' }
        ]
      );
    } catch (error: any) {
      console.error('Error saving invoice:', error);
      const errorMessage = error?.message || 'Unknown error';
      Alert.alert(
        'შენახვა ვერ მოხერხდა',
        `შეცდომა: ${errorMessage}\n\nშეამოწმეთ:\n• Firebase კონფიგურაცია\n• ინტერნეტ კავშირი\n• Firestore ნებართვები`,
        [{ text: 'კარგი' }]
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartJob = () => {
    if (!customerInfo.phone) {
      Alert.alert(
        'კლიენტის ინფორმაცია',
        'გთხოვთ დაამატოთ ტელეფონის ნომერი სამუშაოს დაწყებამდე',
        [{ text: 'დამატება', onPress: () => setShowCustomerModal(true) }]
      );
      return;
    }

    Alert.alert(
      'სამუშაოს დაწყება',
      `დაიწყება მუშაობა ${estimateItems.length} სერვისზე თანხით ${formatCurrencyGEL(getTotalPrice())}?`,
      [
        { text: 'გაუქმება', style: 'cancel' },
        { 
          text: 'დაწყება', 
          onPress: () => {
            setJobStarted(true);
            // Navigate to job management or back to dashboard
            setTimeout(() => {
              Alert.alert(
                '✅ მუშაობა დაიწყო!',
                'სამუშაო დაწყებულად არის მონიშნული. თვალი ადევნეთ საქმეების ტაბიდან.',
                [{ text: 'კარგი', onPress: () => router.push('/(tabs)/cases') }]
              );
            }, 1000);
          }
        }
      ]
    );
  };

  // Computed discount values for display
  const svcDiscPct = parseFloat(servicesDiscount) || 0;
  const prtDiscPct = parseFloat(partsDiscount) || 0;
  const glbDiscPct = parseFloat(globalDiscount) || 0;
  const hasAnyDiscount = svcDiscPct > 0 || prtDiscPct > 0 || glbDiscPct > 0;
  const rawServicesTotal = estimateItems.reduce((t, i) => t + i.price, 0);
  const rawPartsTotal = parts.reduce((t, p) => t + p.totalPrice, 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Gradient Header */}
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>შეფასების შეჯამება</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerBtn} onPress={generateAndSendPDF}>
              <MaterialCommunityIcons name="share-variant-outline" size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/admin/cpanel-test')}>
              <MaterialCommunityIcons name="api" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Total Price Banner */}
        <View style={styles.totalBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.totalLabel}>სულ შეფასება</Text>
            <Text style={styles.totalSubtext} numberOfLines={1}>
              {estimateItems.length} სერვისი{parts.length > 0 ? ` • ${parts.length} ნაწილი` : ''}
              {hasAnyDiscount ? ' • ფასდაკლებით' : ''}
            </Text>
          </View>
          <View style={styles.totalPriceWrap}>
            <Text style={styles.totalPrice}>{formatCurrencyGEL(getTotalPrice())}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Discounts & VAT Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconCircle}>
              <MaterialCommunityIcons name="sale" size={18} color={COLORS.error} />
            </View>
            <Text style={styles.sectionTitle}>ფასდაკლებები</Text>
          </View>

          <View style={styles.discountGrid}>
            {/* Services Discount */}
            <View style={styles.discountCell}>
              <Text style={styles.discountCellLabel}>სერვისები</Text>
              <View style={styles.discountInputWrap}>
                <TextInput
                  value={servicesDiscount}
                  onChangeText={setServicesDiscount}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  style={styles.discountInputField}
                  mode="outlined"
                  dense
                  outlineColor={COLORS.outline}
                  activeOutlineColor={COLORS.primary}
                />
                <Text style={styles.pctLabel}>%</Text>
              </View>
              {svcDiscPct > 0 && (
                <Text style={styles.discountSavedText}>-{formatCurrencyGEL(rawServicesTotal * svcDiscPct / 100)}</Text>
              )}
            </View>

            {/* Parts Discount */}
            <View style={styles.discountCell}>
              <Text style={styles.discountCellLabel}>ნაწილები</Text>
              <View style={styles.discountInputWrap}>
                <TextInput
                  value={partsDiscount}
                  onChangeText={setPartsDiscount}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  style={styles.discountInputField}
                  mode="outlined"
                  dense
                  outlineColor={COLORS.outline}
                  activeOutlineColor={COLORS.primary}
                />
                <Text style={styles.pctLabel}>%</Text>
              </View>
              {prtDiscPct > 0 && (
                <Text style={styles.discountSavedText}>-{formatCurrencyGEL(rawPartsTotal * prtDiscPct / 100)}</Text>
              )}
            </View>

            {/* Global Discount */}
            <View style={styles.discountCell}>
              <Text style={[styles.discountCellLabel, { fontWeight: '700' }]}>საერთო</Text>
              <View style={styles.discountInputWrap}>
                <TextInput
                  value={globalDiscount}
                  onChangeText={setGlobalDiscount}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  style={styles.discountInputField}
                  mode="outlined"
                  dense
                  outlineColor={COLORS.outline}
                  activeOutlineColor={COLORS.error}
                />
                <Text style={styles.pctLabel}>%</Text>
              </View>
              {glbDiscPct > 0 && (
                <Text style={styles.discountSavedText}>-{formatCurrencyGEL((rawServicesTotal + rawPartsTotal) * glbDiscPct / 100)}</Text>
              )}
            </View>
          </View>

          {/* Quick Chips */}
          <View style={styles.quickChipRow}>
            {[5, 10, 15, 20].map(pct => (
              <TouchableOpacity
                key={pct}
                style={[
                  styles.quickChip,
                  glbDiscPct === pct && styles.quickChipActive,
                ]}
                onPress={() => setGlobalDiscount(glbDiscPct === pct ? '0' : String(pct))}
              >
                <Text style={[styles.quickChipText, glbDiscPct === pct && styles.quickChipTextActive]}>{pct}%</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.divider} />

          {/* VAT Toggle */}
          <TouchableOpacity
            style={[styles.vatToggle, includeVAT && styles.vatToggleActive]}
            onPress={() => setIncludeVAT(!includeVAT)}
          >
            <MaterialCommunityIcons
              name={includeVAT ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={22}
              color={includeVAT ? COLORS.primary : COLORS.text.tertiary}
            />
            <Text style={styles.vatLabel}>დღგ +18%</Text>
            {includeVAT && (
              <Text style={styles.vatAmount}>+{formatCurrencyGEL(getVATAmount())}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Customer Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconCircle, { backgroundColor: COLORS.secondary + '15' }]}>
              <MaterialCommunityIcons name="account" size={18} color={COLORS.secondary} />
            </View>
            <Text style={styles.sectionTitle}>მომხმარებელი</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.qrScanBtn} onPress={handleQRScan}>
              <MaterialCommunityIcons name="qrcode-scan" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {customerInfo.phone ? (
            <View style={styles.customerInfoCard}>
              <View style={styles.customerAvatarCircle}>
                <MaterialCommunityIcons name="account" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.customerDetails}>
                {customerInfo.isRepeat && (
                  <View style={styles.repeatBadge}>
                    <MaterialCommunityIcons name="star" size={10} color="#FFF" />
                    <Text style={styles.repeatBadgeText}>მუდმივი</Text>
                  </View>
                )}
                {customerInfo.name && (
                  <Text style={styles.customerName}>{customerInfo.name}</Text>
                )}
                <Text style={styles.customerPhone}>{customerInfo.phone}</Text>
              </View>
              <TouchableOpacity
                style={styles.editCustomerBtn}
                onPress={() => setShowCustomerModal(true)}
              >
                <MaterialCommunityIcons name="pencil-outline" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addCustomerButton}
              onPress={() => setShowCustomerModal(true)}
            >
              <MaterialCommunityIcons name="account-plus-outline" size={22} color={COLORS.primary} />
              <Text style={styles.addCustomerText}>მომხმარებლის დამატება</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Services Breakdown */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconCircle, { backgroundColor: COLORS.primary + '15' }]}>
              <MaterialCommunityIcons name="wrench" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.sectionTitle}>სერვისების ჩამონათვალი</Text>
          </View>
            
            {(() => {
              const groupedItems = getGroupedEstimateItems();
              return groupedItems.map((item, index) => {
                const displayName = item.serviceNameKa || item.serviceName;
                return (
                  <View key={`${displayName}-${index}`}>
                    <List.Item
                      title={item.count > 1 ? `${displayName} (×${item.count})` : displayName}
                      description={
                        item.count > 1
                          ? `${item.count} × ${formatCurrencyGEL(item.price / item.count)} თითო`
                          : 'ერთი სერვისი'
                      }
                      right={() => (
                        <Text style={styles.itemPrice}>{formatCurrencyGEL(item.price)}</Text>
                      )}
                      left={() => (
                        <View style={styles.serviceIconContainer}>
                          <MaterialCommunityIcons
                            name="wrench"
                            size={24}
                            color={COLORS.primary}
                          />
                          {item.count > 1 && (
                            <Chip
                              mode="flat"
                              style={styles.countBadge}
                              textStyle={styles.countBadgeText}
                            >
                              ×{item.count}
                            </Chip>
                          )}
                        </View>
                      )}
                      titleStyle={styles.serviceTitle}
                      descriptionStyle={styles.serviceDescription}
                    />
                    {index < groupedItems.length - 1 && <Divider />}
                  </View>
                );
              });
            })()}

            {/* Services Subtotal */}
            {parts.length > 0 && (
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>სერვისების ჯამი:</Text>
                <Text style={styles.subtotalPrice}>{formatCurrencyGEL(getServicesTotal())}</Text>
              </View>
            )}
        </View>

        {/* Parts Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconCircle, { backgroundColor: COLORS.accent + '15' }]}>
              <MaterialCommunityIcons name="cog" size={18} color={COLORS.accent} />
            </View>
            <Text style={styles.sectionTitle}>ნაწილები</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.addPartBtnSmall} onPress={openAddPartModal}>
              <MaterialCommunityIcons name="plus" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
            
            {parts.length === 0 ? (
              <Button
                mode="outlined"
                onPress={openAddPartModal}
                icon="plus"
                style={styles.addPartButton}
                contentStyle={styles.addCustomerButtonContent}
                labelStyle={styles.addCustomerButtonLabel}
              >
                ნაწილის დამატება
              </Button>
            ) : (
              <View>
                {parts.map((part, index) => {
                  const displayName = part.nameKa || part.name;
                  const partKey = part.id || `part-index-${index}`;
                  return (
                    <View key={partKey}>
                      <List.Item
                        title={part.quantity > 1 ? `${displayName} (×${part.quantity})` : displayName}
                        description={
                          part.partNumber 
                            ? `${part.partNumber} • ${formatCurrencyGEL(part.unitPrice)} თითო`
                            : `${formatCurrencyGEL(part.unitPrice)} თითო`
                        }
                        right={() => (
                          <View style={styles.partRightSection}>
                            <Text style={styles.itemPrice}>{formatCurrencyGEL(part.totalPrice)}</Text>
                            <View style={styles.partActions}>
                              <IconButton
                                icon="pencil"
                                iconColor={COLORS.primary}
                                size={18}
                                onPress={() => openEditPartModal(part)}
                              />
                              <IconButton
                                icon="delete"
                                iconColor={COLORS.error}
                                size={18}
                                onPress={() => handleDeletePart(part.id)}
                              />
                            </View>
                          </View>
                        )}
                        left={() => (
                          <View style={styles.serviceIconContainer}>
                            <MaterialCommunityIcons
                              name="cog"
                              size={24}
                              color={COLORS.accent}
                            />
                            {part.quantity > 1 && (
                              <Chip
                                mode="flat"
                                style={[styles.countBadge, { backgroundColor: COLORS.accent }]}
                                textStyle={styles.countBadgeText}
                              >
                                ×{part.quantity}
                              </Chip>
                            )}
                          </View>
                        )}
                        titleStyle={styles.serviceTitle}
                        descriptionStyle={styles.serviceDescription}
                      />
                      {index < parts.length - 1 && <Divider />}
                    </View>
                  );
                })}
                
                {/* Parts Subtotal */}
                <View style={styles.subtotalRow}>
                  <Text style={styles.subtotalLabel}>ნაწილების ჯამი:</Text>
                  <Text style={styles.subtotalPrice}>{formatCurrencyGEL(getPartsTotal())}</Text>
                </View>
              </View>
            )}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          onPress={saveInvoice}
          disabled={isSaving || invoiceSaved}
          style={[styles.saveBtn, invoiceSaved && styles.saveBtnDone]}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={invoiceSaved ? [COLORS.success, '#059669'] : [COLORS.primary, COLORS.primaryDark]}
            style={styles.saveBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <MaterialCommunityIcons
                name={invoiceSaved ? 'check-circle' : 'content-save-outline'}
                size={20}
                color="#FFF"
              />
            )}
            <Text style={styles.saveBtnText}>
              {isSaving ? 'ინახება...' : invoiceSaved ? 'შენახულია!' : 'ინვოისის შენახვა'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.whatsappBtn}
            onPress={generateAndSendPDF}
            disabled={isGeneratingPDF}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="whatsapp" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>
              {isGeneratingPDF ? 'იგზავნება...' : 'WhatsApp'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.startBtn, (!customerInfo.phone || jobStarted) && styles.actionBtnDisabled]}
            onPress={handleStartJob}
            disabled={!customerInfo.phone || jobStarted}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name={jobStarted ? 'check-circle' : 'play-circle-outline'}
              size={20}
              color="#FFF"
            />
            <Text style={styles.actionBtnText}>
              {jobStarted ? 'დაწყებულია!' : 'სამუშაოს დაწყ...'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Customer Input Modal */}
      <Portal>
        <Modal
          visible={showCustomerModal}
          onDismiss={() => setShowCustomerModal(false)}
          contentContainerStyle={styles.customerModal}
        >
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalIconContainer}>
              <MaterialCommunityIcons name="account-circle" size={48} color={COLORS.primary} />
            </View>
            <Text style={styles.modalTitle}>მომხმარებლის ინფორმაცია</Text>
            <Text style={styles.modalSubtitle}>შეავსეთ მომხმარებლის მონაცემები</Text>
          </View>

          <Divider style={styles.modalDivider} />

          {/* Form Fields */}
          <View style={styles.formSection}>
            <TextInput
              label="ტელეფონის ნომერი *"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              placeholder="+995 XXX XXX XXX"
              style={styles.formInput}
              autoFocus
              mode="outlined"
              outlineColor={COLORS.outline}
              activeOutlineColor={COLORS.primary}
              left={<TextInput.Icon icon="phone" color={phoneNumber ? COLORS.primary : COLORS.text.tertiary} />}
              right={searchingCustomer ? <ActivityIndicator size="small" color={COLORS.primary} /> : 
                phoneNumber.trim() ? <TextInput.Icon icon="check-circle" color={COLORS.success} /> : undefined}
              error={!phoneNumber.trim()}
            />

            <TextInput
              label="მომხმარებლის სახელი"
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="მაგ. გიორგი გიორგაძე"
              style={styles.formInput}
              mode="outlined"
              outlineColor={COLORS.outline}
              activeOutlineColor={COLORS.primary}
              left={<TextInput.Icon icon="account" color={customerName ? COLORS.primary : COLORS.text.tertiary} />}
            />

            <TextInput
              label="სახელმწიფო ნომერი"
              value={plate}
              onChangeText={(text) => setPlate(text.toUpperCase())}
              placeholder="AA-123-BB"
              style={styles.formInput}
              mode="outlined"
              outlineColor={COLORS.outline}
              activeOutlineColor={COLORS.primary}
              autoCapitalize="characters"
              left={<TextInput.Icon icon="car" color={plate ? COLORS.primary : COLORS.text.tertiary} />}
            />

            {/* Car Make & Model Section */}
            <View style={styles.carSelectorSection}>
              <View style={styles.sectionLabelRow}>
                <MaterialCommunityIcons name="car-settings" size={20} color={COLORS.text.secondary} />
                <Text style={styles.sectionLabel}>მანქანის მარკა და მოდელი</Text>
              </View>
              <CarSelector
                value={carMakeId && carModelId ? {
                  makeId: carMakeId,
                  makeName: carMake,
                  modelId: carModelId,
                  modelName: carModel,
                } : null}
                onChange={(car: SelectedCar | null) => {
                  if (car) {
                    setCarMake(car.makeName);
                    setCarModel(car.modelName);
                    setCarMakeId(car.makeId);
                    setCarModelId(car.modelId);
                  } else {
                    setCarMake('');
                    setCarModel('');
                    setCarMakeId('');
                    setCarModelId('');
                  }
                }}
                placeholder="აირჩიეთ მარკა და მოდელი"
              />
            </View>
          </View>

          <Divider style={styles.modalDivider} />

          {/* Action Buttons */}
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={handleQRScan}
              icon="qrcode-scan"
              style={styles.qrButton}
              contentStyle={styles.qrButtonContent}
              labelStyle={styles.qrButtonLabel}
            >
              QR სკანირება
            </Button>
            <Button
              mode="contained"
              onPress={handlePhoneSubmit}
              style={styles.submitButton}
              contentStyle={styles.submitButtonContent}
              labelStyle={styles.submitButtonLabel}
              disabled={!phoneNumber.trim()}
              icon="content-save"
            >
              შენახვა
            </Button>
          </View>

          {/* Close Button */}
          <IconButton
            icon="close"
            size={24}
            onPress={() => setShowCustomerModal(false)}
            style={styles.modalCloseButton}
            iconColor={COLORS.text.secondary}
          />
        </Modal>
      </Portal>

      {/* Parts Modal */}
      <Portal>
        <Modal
          visible={showPartsModal}
          onDismiss={() => setShowPartsModal(false)}
          contentContainerStyle={styles.customerModal}
        >
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={[styles.modalIconContainer, { backgroundColor: `${COLORS.accent}15` }]}>
              <MaterialCommunityIcons name="cog" size={48} color={COLORS.accent} />
            </View>
            <Text style={styles.modalTitle}>
              {editingPart ? 'ნაწილის რედაქტირება' : 'ახალი ნაწილი'}
            </Text>
            <Text style={styles.modalSubtitle}>შეავსეთ ნაწილის მონაცემები</Text>
          </View>

          <Divider style={styles.modalDivider} />

          {/* Form Fields */}
          <ScrollView style={styles.partFormScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.formSection}>
              <TextInput
                label="ნაწილის სახელი (ქართულად)"
                value={partNameKa}
                onChangeText={setPartNameKa}
                placeholder="მაგ. საჭე, ფარი"
                style={styles.formInput}
                mode="outlined"
                outlineColor={COLORS.outline}
                activeOutlineColor={COLORS.accent}
                left={<TextInput.Icon icon="cog" color={partNameKa ? COLORS.accent : COLORS.text.tertiary} />}
              />

              <TextInput
                label="Part Name (English) (არასავალდებულო)"
                value={partName}
                onChangeText={setPartName}
                placeholder="e.g. Steering Wheel, Bumper"
                style={styles.formInput}
                mode="outlined"
                outlineColor={COLORS.outline}
                activeOutlineColor={COLORS.accent}
                left={<TextInput.Icon icon="cog-outline" color={partName ? COLORS.accent : COLORS.text.tertiary} />}
              />

              <TextInput
                label="ნაწილის ნომერი (არასავალდებულო)"
                value={partNumber}
                onChangeText={setPartNumber}
                placeholder="მაგ. OEM-12345"
                style={styles.formInput}
                mode="outlined"
                outlineColor={COLORS.outline}
                activeOutlineColor={COLORS.accent}
                left={<TextInput.Icon icon="barcode" color={partNumber ? COLORS.accent : COLORS.text.tertiary} />}
              />

              <View style={styles.partQuantityPriceRow}>
                <TextInput
                  label="რაოდენობა"
                  value={partQuantity}
                  onChangeText={setPartQuantity}
                  keyboardType="numeric"
                  style={[styles.formInput, styles.halfWidth]}
                  mode="outlined"
                  outlineColor={COLORS.outline}
                  activeOutlineColor={COLORS.accent}
                  left={<TextInput.Icon icon="counter" color={COLORS.accent} />}
                />

                <TextInput
                  label="ფასი (₾) *"
                  value={partUnitPrice}
                  onChangeText={setPartUnitPrice}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  style={[styles.formInput, styles.halfWidth]}
                  mode="outlined"
                  outlineColor={COLORS.outline}
                  activeOutlineColor={COLORS.accent}
                  left={<TextInput.Icon icon="currency-try" color={partUnitPrice ? COLORS.accent : COLORS.text.tertiary} />}
                  error={!partUnitPrice}
                />
              </View>

              <TextInput
                label="შენიშვნა (არასავალდებულო)"
                value={partNotes}
                onChangeText={setPartNotes}
                placeholder="დამატებითი ინფორმაცია"
                style={styles.formInput}
                mode="outlined"
                outlineColor={COLORS.outline}
                activeOutlineColor={COLORS.accent}
                multiline
                numberOfLines={2}
                left={<TextInput.Icon icon="note-text" color={partNotes ? COLORS.accent : COLORS.text.tertiary} />}
              />

              {/* Price Preview */}
              {partUnitPrice && (
                <View style={styles.pricePreview}>
                  <Text style={styles.pricePreviewLabel}>ჯამური ფასი:</Text>
                  <Text style={styles.pricePreviewValue}>
                    {formatCurrencyGEL((parseInt(partQuantity) || 1) * (parseFloat(partUnitPrice) || 0))}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          <Divider style={styles.modalDivider} />

          {/* Action Buttons */}
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setShowPartsModal(false);
                setEditingPart(null);
                setPartName('');
                setPartNameKa('');
                setPartNumber('');
                setPartQuantity('1');
                setPartUnitPrice('');
                setPartNotes('');
              }}
              style={styles.qrButton}
              contentStyle={styles.qrButtonContent}
              labelStyle={styles.qrButtonLabel}
            >
              გაუქმება
            </Button>
            <Button
              mode="contained"
              onPress={handleSavePart}
              style={[styles.submitButton, { backgroundColor: COLORS.accent }]}
              contentStyle={styles.submitButtonContent}
              labelStyle={styles.submitButtonLabel}
              disabled={!partUnitPrice || (!partName.trim() && !partNameKa.trim())}
              icon="content-save"
            >
              {editingPart ? 'განახლება' : 'დამატება'}
            </Button>
          </View>

          {/* Close Button */}
          <IconButton
            icon="close"
            size={24}
            onPress={() => {
              setShowPartsModal(false);
              setEditingPart(null);
              setPartName('');
              setPartNameKa('');
              setPartNumber('');
              setPartQuantity('1');
              setPartUnitPrice('');
              setPartNotes('');
            }}
            style={styles.modalCloseButton}
            iconColor={COLORS.text.secondary}
          />
        </Modal>
      </Portal>

      {/* QR Scanner Modal */}
      <Portal>
        <Modal
          visible={showQRScanner}
          onDismiss={() => setShowQRScanner(false)}
          contentContainerStyle={styles.scannerModal}
        >
          <View style={styles.scannerHeader}>
            <Text style={styles.modalTitle}>Scan Customer QR</Text>
            <IconButton
              icon="close"
              onPress={() => setShowQRScanner(false)}
            />
          </View>
          
          {permission?.granted ? (
            <View style={styles.cameraContainer}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="back"
                onBarcodeScanned={handleQRCodeScanned}
              >
                <View style={styles.scannerOverlay}>
                  <View style={styles.scannerFrame} />
                  <Text style={styles.scannerText}>
                    Position customer's QR code in the frame
                  </Text>
                </View>
              </CameraView>
            </View>
          ) : (
            <View style={styles.permissionContainer}>
              <MaterialCommunityIcons 
                name="camera-off" 
                size={48} 
                color={COLORS.text.tertiary} 
              />
              <Text style={styles.permissionText}>Camera access needed for QR scanning</Text>
              <Button mode="contained" onPress={requestPermission}>
                Grant Permission
              </Button>
            </View>
          )}
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
  // ── Gradient Header ──
  headerGradient: {
    paddingTop: STATUSBAR_HEIGHT + 4,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.3,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  totalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BORDER_RADIUS.xl,
    padding: 16,
    gap: 12,
  },
  totalLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '600',
  },
  totalSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  totalPriceWrap: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.lg,
  },
  totalPrice: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  // ── Section Cards ──
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: 16,
    marginBottom: 14,
    ...SHADOWS.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.error + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  // ── Discount Section ──
  discountGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  discountCell: {
    flex: 1,
    gap: 4,
  },
  discountCellLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  discountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discountInputField: {
    backgroundColor: COLORS.background,
    flex: 1,
    height: 40,
    fontSize: 15,
  },
  pctLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.tertiary,
    marginLeft: 4,
  },
  discountSavedText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.error,
    textAlign: 'center',
  },
  quickChipRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 12,
  },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  quickChipActive: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  quickChipTextActive: {
    color: '#FFF',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.outline,
    marginVertical: 12,
  },
  vatToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  vatToggleActive: {},
  vatLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    flex: 1,
  },
  vatAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.success,
  },
  // ── Customer Section ──
  qrScanBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.background,
    padding: 14,
    borderRadius: BORDER_RADIUS.lg,
  },
  customerAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerDetails: {
    flex: 1,
  },
  repeatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  repeatBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  customerPhone: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginTop: 1,
  },
  editCustomerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCustomerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.primary + '40',
    backgroundColor: COLORS.primary + '06',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 18,
  },
  addCustomerText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  // ── Services & Parts ──
  serviceIconContainer: {
    width: 50,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: BORDER_RADIUS.sm,
    position: 'relative',
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: COLORS.primary,
    height: 18,
    minWidth: 18,
  },
  countBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    color: '#FFF',
    fontWeight: 'bold',
  },
  serviceTitle: {
    fontWeight: '500',
  },
  serviceDescription: {
    color: COLORS.text.secondary,
    fontSize: 12,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    alignSelf: 'center',
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.md,
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  subtotalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  subtotalPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  addPartBtnSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPartButton: {
    borderColor: COLORS.accent,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: `${COLORS.accent}08`,
  },
  partRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  partActions: {
    flexDirection: 'row',
  },
  // ── Action Buttons ──
  actionButtons: {
    padding: 16,
    gap: 10,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  saveBtn: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  saveBtnDone: {},
  saveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: BORDER_RADIUS.lg,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  whatsappBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#25D366',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 14,
  },
  startBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.secondary,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 14,
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  // ── Modals ──
  addCustomerButtonContent: {
    height: 56,
  },
  addCustomerButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  partFormScroll: {
    maxHeight: 300,
  },
  partQuantityPriceRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  halfWidth: {
    flex: 1,
  },
  pricePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: `${COLORS.accent}15`,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.sm,
  },
  pricePreviewLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.accent,
  },
  pricePreviewValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.accent,
  },
  customerModal: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    position: 'relative',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    color: COLORS.text.secondary,
    textAlign: 'center',
    fontSize: 14,
  },
  modalDivider: {
    marginVertical: SPACING.md,
    backgroundColor: COLORS.outline,
  },
  modalCloseButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.surfaceVariant,
  },
  formSection: {
    gap: SPACING.md,
  },
  formInput: {
    backgroundColor: COLORS.surface,
  },
  carSelectorSection: {
    marginTop: SPACING.sm,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  qrButton: {
    flex: 1,
    borderColor: COLORS.primary,
    borderWidth: 1.5,
  },
  qrButtonContent: {
    height: 48,
  },
  qrButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
  },
  submitButtonContent: {
    height: 48,
  },
  submitButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.onPrimary,
  },
  scannerModal: {
    backgroundColor: COLORS.surface,
    margin: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    height: 400,
  },
  scannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  scannerFrame: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
    borderRadius: BORDER_RADIUS.md,
  },
  scannerText: {
    color: COLORS.text.onPrimary,
    textAlign: 'center',
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  permissionText: {
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginVertical: SPACING.lg,
  },
  carMakeModelRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  halfInput: {
    flex: 1,
  },
});