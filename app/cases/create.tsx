import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useNavigation } from 'expo-router';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    BackHandler,
    Dimensions,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    PanResponder,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Vibration,
    View,
} from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import { CarSelector, SelectedCar } from '../../src/components/common/CarSelector';
import { COLORS, SHADOWS } from '../../src/config/constants';
import { DEFAULT_SERVICES } from '../../src/config/services';
import { createInspection, getAllInspections } from '../../src/services/firebase';
import { ServiceService } from '../../src/services/serviceService';
import { formatCurrencyGEL } from '../../src/utils/helpers';

const { width } = Dimensions.get('window');

// ─── Types ───────────────────────────────────────────────────
interface ServiceItem {
  key: string;
  nameKa: string;
  nameEn: string;
  basePrice: number;
  category: string;
  quantity: number;
  price: number;
  customPrice: number;   // user-edited unit price (defaults to basePrice)
  discount: number;      // per-item discount %
}

interface PartItem {
  id: string;
  nameKa: string;
  nameEn: string;
  quantity: number;
  unitPrice: number;
  discount: number;      // per-item discount %
}

interface PhotoTag {
  id: string;
  x: number;  // percent 0-100
  y: number;  // percent 0-100
  serviceKey: string;
  serviceNameKa: string;
  serviceNameEn: string;
  price: number;
}

interface PhotoItem {
  id: string;
  uri: string;
  label: string;
  tags: PhotoTag[];
}

// ─── Steps ───────────────────────────────────────────────────
type StepKey = 'customer' | 'vehicle' | 'services' | 'photos' | 'review';

const STEPS: { key: StepKey; label: string; icon: string }[] = [
  { key: 'customer', label: 'კლიენტი', icon: 'account' },
  { key: 'vehicle', label: 'მანქანა', icon: 'car' },
  { key: 'services', label: 'სერვისები', icon: 'wrench' },
  { key: 'photos', label: 'ფოტოები', icon: 'camera' },
  { key: 'review', label: 'დადასტურება', icon: 'check-circle' },
];

// ─── Service Categories ──────────────────────────────────────
const CATEGORY_MAP: Record<string, { label: string; icon: string; color: string }> = {
  bodywork: { label: 'თუნუქი', icon: 'hammer', color: '#F97316' },
  painting: { label: 'საღებავი', icon: 'format-paint', color: '#3B82F6' },
  mechanical: { label: 'მექანიკა', icon: 'cog', color: '#7C3AED' },
  specialized: { label: 'სპეციალური', icon: 'star-circle', color: '#EC4899' },
  finishing: { label: 'დამუშავება', icon: 'shimmer', color: '#F59E0B' },
};

// ─── Component ───────────────────────────────────────────────
export default function CreateCaseScreen() {
  // Step state
  const [currentStep, setCurrentStep] = useState(0);

  // Customer
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isRepeatCustomer, setIsRepeatCustomer] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [customerFound, setCustomerFound] = useState(false);

  // Vehicle
  const [plate, setPlate] = useState('');
  const [carMake, setCarMake] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carMakeId, setCarMakeId] = useState('');
  const [carModelId, setCarModelId] = useState('');

  // Services
  const [availableServices, setAvailableServices] = useState<ServiceItem[]>([]);
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loadingServices, setLoadingServices] = useState(true);

  // Parts
  const [parts, setParts] = useState<PartItem[]>([]);
  const [showPartForm, setShowPartForm] = useState(false);
  const [partNameKa, setPartNameKa] = useState('');
  const [partPrice, setPartPrice] = useState('');
  const [partQty, setPartQty] = useState('1');

  // Photos
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  // Photo Tagging
  const [taggingPhoto, setTaggingPhoto] = useState<PhotoItem | null>(null);
  const [showTaggingModal, setShowTaggingModal] = useState(false);
  const [pendingTagPos, setPendingTagPos] = useState<{ x: number; y: number } | null>(null);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [tagImageLayout, setTagImageLayout] = useState({ width: 0, height: 0 });
  const [draggingTagId, setDraggingTagId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const tagPanResponders = useRef<Record<string, any>>({});

  // Case type & notes
  const [caseType, setCaseType] = useState<'დაზღვევა' | 'საცალო' | null>(null);
  const [notes, setNotes] = useState('');

  // VAT
  const [includeVAT, setIncludeVAT] = useState(false);
  const VAT_RATE = 0.18;

  // Discounts
  const [servicesDiscount, setServicesDiscount] = useState('');
  const [partsDiscount, setPartsDiscount] = useState('');
  const [globalDiscount, setGlobalDiscount] = useState('');
  const [showDiscounts, setShowDiscounts] = useState(false);

  // Saving
  const [isSaving, setIsSaving] = useState(false);

  // Animation
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const scrollRef = useRef<ScrollView>(null);

  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({
      title: '➕ ახალი საქმე',
      headerStyle: { backgroundColor: COLORS.surface },
      headerTintColor: COLORS.text.primary,
    });
  }, [navigation]);

  // Load services
  useEffect(() => {
    loadServices();
  }, []);

  // Handle Android back button — go back 1 step instead of exiting
  useEffect(() => {
    const onBackPress = () => {
      if (showTaggingModal) {
        closeTagging();
        return true;
      }
      if (currentStep > 0) {
        goBack();
        return true;
      }
      return false; // let default behavior (exit screen) happen on step 0
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [currentStep, showTaggingModal]);

  const loadServices = async () => {
    try {
      setLoadingServices(true);
      const dbServices = await ServiceService.getAllServices();
      const items: ServiceItem[] = dbServices.map(s => ({
        key: s.key,
        nameKa: s.nameKa,
        nameEn: s.nameEn,
        basePrice: s.basePrice,
        category: s.category,
        quantity: 0,
        price: s.basePrice,
        customPrice: s.basePrice,
        discount: 0,
      }));
      setAvailableServices(items);
    } catch {
      const items: ServiceItem[] = Object.values(DEFAULT_SERVICES).map(s => ({
        key: s.key,
        nameKa: s.nameKa,
        nameEn: s.nameEn,
        basePrice: s.basePrice,
        category: s.category,
        quantity: 0,
        price: s.basePrice,
        customPrice: s.basePrice,
        discount: 0,
      }));
      setAvailableServices(items);
    } finally {
      setLoadingServices(false);
    }
  };

  // Auto-search customer by phone
  useEffect(() => {
    const clean = customerPhone.replace(/\s/g, '');
    if (clean.length >= 9) {
      const t = setTimeout(() => searchCustomer(clean), 600);
      return () => clearTimeout(t);
    } else {
      setCustomerFound(false);
    }
  }, [customerPhone]);

  const searchCustomer = async (phone: string) => {
    try {
      setSearchingCustomer(true);
      const inspections = await getAllInspections();
      const matches = (inspections as any[])
        .filter((inv: any) => inv.customerPhone?.replace(/\s/g, '') === phone)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (matches.length > 0) {
        const last = matches[0];
        setCustomerName(last.customerName || '');
        setCarMake(last.carMake || '');
        setCarModel(last.carModel || '');
        setCarMakeId(last.carMakeId || '');
        setCarModelId(last.carModelId || '');
        setPlate(last.plate || '');
        setIsRepeatCustomer(true);
        setCustomerFound(true);
        Vibration.vibrate(50);
      } else {
        setIsRepeatCustomer(false);
        setCustomerFound(false);
      }
    } catch {
      // silent
    } finally {
      setSearchingCustomer(false);
    }
  };

  // ─── Step Animation ─────────────────────────────────────────
  const animateStepChange = (next: number) => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: next > currentStep ? -30 : 30, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setCurrentStep(next);
      slideAnim.setValue(next > currentStep ? 30 : -30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const goNext = () => {
    if (currentStep < STEPS.length - 1) animateStepChange(currentStep + 1);
  };
  const goBack = () => {
    if (currentStep > 0) animateStepChange(currentStep - 1);
  };

  // ─── Service Helpers ────────────────────────────────────────
  const recalcServicePrice = (s: ServiceItem): ServiceItem => {
    const unitPrice = s.customPrice;
    const discounted = unitPrice * (1 - (s.discount || 0) / 100);
    return { ...s, price: discounted * s.quantity };
  };

  const toggleService = (svc: ServiceItem) => {
    const exists = selectedServices.find(s => s.key === svc.key);
    if (exists) {
      setSelectedServices(prev => prev.filter(s => s.key !== svc.key));
    } else {
      setSelectedServices(prev => [...prev, recalcServicePrice({ ...svc, quantity: 1, customPrice: svc.basePrice, discount: 0, price: svc.basePrice })]);
    }
    Vibration.vibrate(30);
  };

  const updateServiceQty = (key: string, delta: number) => {
    setSelectedServices(prev =>
      prev.map(s => {
        if (s.key !== key) return s;
        const newQty = Math.max(0.1, Math.round((s.quantity + delta) * 10) / 10);
        return recalcServicePrice({ ...s, quantity: newQty });
      })
    );
  };

  const updateServiceQtyDirect = (key: string, text: string) => {
    setSelectedServices(prev =>
      prev.map(s => {
        if (s.key !== key) return s;
        const parsed = parseFloat(text);
        const newQty = isNaN(parsed) || parsed <= 0 ? 0 : parsed;
        return recalcServicePrice({ ...s, quantity: newQty || s.quantity });
      })
    );
  };

  const updateServiceCustomPrice = (key: string, text: string) => {
    setSelectedServices(prev =>
      prev.map(s => {
        if (s.key !== key) return s;
        const parsed = parseFloat(text);
        const newPrice = isNaN(parsed) || parsed < 0 ? 0 : parsed;
        return recalcServicePrice({ ...s, customPrice: newPrice });
      })
    );
  };

  const updateServiceDiscount = (key: string, text: string) => {
    setSelectedServices(prev =>
      prev.map(s => {
        if (s.key !== key) return s;
        const parsed = parseFloat(text);
        const disc = isNaN(parsed) || parsed < 0 ? 0 : Math.min(parsed, 100);
        return recalcServicePrice({ ...s, discount: disc });
      })
    );
  };

  const filteredServices = availableServices.filter(s => {
    const matchesSearch = !serviceSearch ||
      s.nameKa.toLowerCase().includes(serviceSearch.toLowerCase()) ||
      s.nameEn.toLowerCase().includes(serviceSearch.toLowerCase());
    const matchesCat = !activeCategory || s.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  // ─── Photo Picker ──────────────────────────────────────────
  const pickPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('ნებართვა', 'გთხოვთ მიეცით გალერეაზე წვდომა');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10,
    });
    if (!result.canceled && result.assets) {
      const newPhotos: PhotoItem[] = result.assets.map((a, i) => ({
        id: `${Date.now()}-${i}`,
        uri: a.uri,
        label: `ფოტო ${photos.length + i + 1}`,
        tags: [],
      }));
      setPhotos(prev => [...prev, ...newPhotos]);
      Vibration.vibrate(50);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('ნებართვა', 'გთხოვთ მიეცით კამერაზე წვდომა');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      const newPhoto: PhotoItem = {
        id: Date.now().toString(),
        uri: result.assets[0].uri,
        label: `ფოტო ${photos.length + 1}`,
        tags: [],
      };
      setPhotos(prev => [...prev, newPhoto]);
      Vibration.vibrate(50);
    }
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  // ─── Photo Tagging ─────────────────────────────────────────
  const openTagging = (photo: PhotoItem) => {
    setTaggingPhoto(photo);
    setPendingTagPos(null);
    setShowServicePicker(false);
    setShowTaggingModal(true);
  };

  const handleTagImagePress = (e: any) => {
    if (tagImageLayout.width === 0) return;
    const { locationX, locationY } = e.nativeEvent;
    const xPct = (locationX / tagImageLayout.width) * 100;
    const yPct = (locationY / tagImageLayout.height) * 100;
    setPendingTagPos({ x: Math.min(95, Math.max(5, xPct)), y: Math.min(95, Math.max(5, yPct)) });
    setShowServicePicker(true);
  };

  const assignServiceToTag = (svc: ServiceItem | { key: string; nameKa: string; nameEn: string; basePrice: number }) => {
    if (!taggingPhoto || !pendingTagPos) return;
    const newTag: PhotoTag = {
      id: `tag-${Date.now()}`,
      x: pendingTagPos.x,
      y: pendingTagPos.y,
      serviceKey: svc.key,
      serviceNameKa: svc.nameKa,
      serviceNameEn: svc.nameEn,
      price: svc.basePrice,
    };
    const updatedPhoto = { ...taggingPhoto, tags: [...taggingPhoto.tags, newTag] };
    setPhotos(prev => prev.map(p => p.id === updatedPhoto.id ? updatedPhoto : p));
    setTaggingPhoto(updatedPhoto);
    setPendingTagPos(null);
    setShowServicePicker(false);
    Vibration.vibrate(30);
  };

  const removeTag = (tagId: string) => {
    if (!taggingPhoto) return;
    const updatedPhoto = { ...taggingPhoto, tags: taggingPhoto.tags.filter(t => t.id !== tagId) };
    setPhotos(prev => prev.map(p => p.id === updatedPhoto.id ? updatedPhoto : p));
    setTaggingPhoto(updatedPhoto);
  };

  const closeTagging = () => {
    setShowTaggingModal(false);
    setTaggingPhoto(null);
    setPendingTagPos(null);
    setShowServicePicker(false);
    setDraggingTagId(null);
    tagPanResponders.current = {};
  };

  const updateTagPosition = (tagId: string, xPct: number, yPct: number) => {
    if (!taggingPhoto) return;
    const clampedX = Math.min(95, Math.max(5, xPct));
    const clampedY = Math.min(95, Math.max(5, yPct));
    const updatedPhoto = {
      ...taggingPhoto,
      tags: taggingPhoto.tags.map(t =>
        t.id === tagId ? { ...t, x: clampedX, y: clampedY } : t
      ),
    };
    setPhotos(prev => prev.map(p => p.id === updatedPhoto.id ? updatedPhoto : p));
    setTaggingPhoto(updatedPhoto);
  };

  const getTagPanResponder = (tag: PhotoTag) => {
    if (tagPanResponders.current[tag.id]) return tagPanResponders.current[tag.id];
    const pr = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 3 || Math.abs(gs.dy) > 3,
      onPanResponderGrant: () => {
        setDraggingTagId(tag.id);
        Vibration.vibrate(20);
      },
      onPanResponderMove: (_, gs) => {
        if (tagImageLayout.width === 0) return;
        const dxPct = (gs.dx / tagImageLayout.width) * 100;
        const dyPct = (gs.dy / tagImageLayout.height) * 100;
        // We find the current tag from the latest taggingPhoto
        const currentTag = taggingPhoto?.tags.find(t => t.id === tag.id);
        if (!currentTag) return;
        // Use initial position from the tag at grant time + delta
        const newX = Math.min(95, Math.max(5, tag.x + dxPct));
        const newY = Math.min(95, Math.max(5, tag.y + dyPct));
        // Direct state update for smooth dragging
        updateTagPosition(tag.id, newX, newY);
      },
      onPanResponderRelease: () => {
        setDraggingTagId(null);
        // Clear cached responder so it gets recreated with new position
        delete tagPanResponders.current[tag.id];
      },
      onPanResponderTerminate: () => {
        setDraggingTagId(null);
        delete tagPanResponders.current[tag.id];
      },
    });
    tagPanResponders.current[tag.id] = pr;
    return pr;
  };

  const totalPhotoTags = photos.reduce((t, p) => t + (p.tags?.length || 0), 0);

  // ─── Add Part ──────────────────────────────────────────────
  const addPart = () => {
    if (!partNameKa.trim() || !partPrice.trim()) return;
    const qty = parseFloat(partQty) || 1;
    const price = parseFloat(partPrice) || 0;
    setParts(prev => [...prev, {
      id: Date.now().toString(),
      nameKa: partNameKa.trim(),
      nameEn: '',
      quantity: qty,
      unitPrice: price,
      discount: 0,
    }]);
    setPartNameKa('');
    setPartPrice('');
    setPartQty('1');
    setShowPartForm(false);
    Vibration.vibrate(30);
  };

  const removePart = (id: string) => {
    setParts(prev => prev.filter(p => p.id !== id));
  };

  const updatePartDiscount = (id: string, text: string) => {
    const parsed = parseFloat(text);
    const disc = isNaN(parsed) || parsed < 0 ? 0 : Math.min(parsed, 100);
    setParts(prev => prev.map(p => p.id !== id ? p : { ...p, discount: disc }));
  };

  // ─── Totals ────────────────────────────────────────────────
  const servicesRaw = selectedServices.reduce((t, s) => t + s.price, 0);
  const partsRaw = parts.reduce((t, p) => {
    const lineTotal = p.unitPrice * p.quantity;
    const afterDisc = lineTotal * (1 - (p.discount || 0) / 100);
    return t + afterDisc;
  }, 0);
  const svcDiscPct = parseFloat(servicesDiscount) || 0;
  const prtDiscPct = parseFloat(partsDiscount) || 0;
  const glbDiscPct = parseFloat(globalDiscount) || 0;
  const servicesTotal = servicesRaw * (1 - svcDiscPct / 100);
  const partsTotal = partsRaw * (1 - prtDiscPct / 100);
  const subtotalBeforeGlobal = servicesTotal + partsTotal;
  const subtotal = subtotalBeforeGlobal * (1 - glbDiscPct / 100);
  const vatAmount = includeVAT ? subtotal * VAT_RATE : 0;
  const grandTotal = subtotal + vatAmount;
  const totalDiscountAmount = (servicesRaw + partsRaw) - subtotal;
  const hasAnyDiscount = svcDiscPct > 0 || prtDiscPct > 0 || glbDiscPct > 0;

  // ─── Save Case ─────────────────────────────────────────────
  const handleSave = async () => {
    if (!plate.trim() && !customerPhone.trim()) {
      Alert.alert('შეცდომა', 'გთხოვთ შეიყვანოთ ნომერი ან ტელეფონი');
      return;
    }

    try {
      setIsSaving(true);

      const services = selectedServices.map(s => ({
        serviceName: s.nameEn,
        serviceNameKa: s.nameKa,
        description: s.nameEn,
        price: s.price,
        unitPrice: s.customPrice,
        count: s.quantity,
        discount: s.discount || 0,
        notes: '',
      }));

      const inventoryParts = parts.map(p => ({
        name: p.nameEn || p.nameKa,
        nameKa: p.nameKa,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        totalPrice: p.unitPrice * p.quantity * (1 - (p.discount || 0) / 100),
        discount: p.discount || 0,
        notes: '',
      }));

      const invoiceData: any = {
        customerName: customerName.trim() || 'N/A',
        customerPhone: customerPhone.trim(),
        carMake,
        carModel,
        carMakeId,
        carModelId,
        plate: plate.trim() || 'N/A',
        totalPrice: grandTotal,
        servicesTotal,
        partsTotal,
        services,
        inventoryParts,
        photos: photos.map(p => ({
          url: p.uri,
          label: p.label,
          tags: (p.tags || []).map(t => ({
            x: t.x,
            y: t.y,
            serviceKey: t.serviceKey,
            serviceNameKa: t.serviceNameKa,
            serviceNameEn: t.serviceNameEn,
            price: t.price,
          })),
        })),
        parts: [],
        services_discount_percent: svcDiscPct,
        parts_discount_percent: prtDiscPct,
        global_discount_percent: glbDiscPct,
        includeVAT,
        vatRate: includeVAT ? VAT_RATE : 0,
        vatAmount,
        subtotalBeforeVAT: subtotal,
        status: 'New',
        statusId: 74,
        caseType: caseType || null,
        internalNotes: notes.trim() ? [{ text: notes.trim(), date: new Date().toISOString(), author: 'app' }] : [],
        isRepeatCustomer,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docId = await createInspection(invoiceData);
      Vibration.vibrate([50, 80, 50]);

      Alert.alert(
        '✅ საქმე შეიქმნა',
        `საქმე #${docId.slice(0, 8).toUpperCase()} წარმატებით შეინახა.`,
        [
          { text: 'საქმეების ნახვა', onPress: () => router.replace('/(tabs)/cases') },
          { text: 'კიდევ ახალი', onPress: () => resetForm() },
        ]
      );
    } catch (error: any) {
      Alert.alert('შეცდომა', `ვერ შეინახა: ${error?.message || 'უცნობი შეცდომა'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(0);
    setCustomerPhone('');
    setCustomerName('');
    setPlate('');
    setCarMake('');
    setCarModel('');
    setCarMakeId('');
    setCarModelId('');
    setSelectedServices([]);
    setParts([]);
    setPhotos([]);
    setCaseType(null);
    setNotes('');
    setIncludeVAT(false);
    setServicesDiscount('');
    setPartsDiscount('');
    setGlobalDiscount('');
    setShowDiscounts(false);
    setIsRepeatCustomer(false);
    setCustomerFound(false);
  };

  // ─── Can proceed validation ────────────────────────────────
  const canProceed = (): boolean => {
    switch (STEPS[currentStep]?.key) {
      case 'customer': return !!(customerPhone.trim().length >= 9 || plate.trim());
      case 'vehicle': return !!(plate.trim() || carMake);
      default: return true;
    }
  };

  // ═══════════════════════════════════════════════════════════
  // ─── Render ────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />

      {/* ─── Step Progress Bar ────────────────────────────── */}
      <View style={styles.progressBar}>
        {STEPS.map((step, i) => {
          const isActive = i === currentStep;
          const isDone = i < currentStep;
          return (
            <TouchableOpacity
              key={step.key}
              style={styles.progressStep}
              onPress={() => i <= currentStep && animateStepChange(i)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.progressDot,
                  isDone && styles.progressDotDone,
                  isActive && styles.progressDotActive,
                ]}
              >
                {isDone ? (
                  <MaterialCommunityIcons name="check" size={12} color="#FFF" />
                ) : (
                  <MaterialCommunityIcons
                    name={step.icon as any}
                    size={14}
                    color={isActive ? '#FFF' : COLORS.text.disabled}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.progressLabel,
                  isActive && styles.progressLabelActive,
                  isDone && styles.progressLabelDone,
                ]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
              {i < STEPS.length - 1 && (
                <View
                  style={[
                    styles.progressLine,
                    (isDone || isActive) && styles.progressLineFilled,
                  ]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─── Step Content ─────────────────────────────────── */}
      <Animated.View
        style={[
          styles.stepContent,
          { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
        ]}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── Step 1: Customer ────────────────────────── */}
          {STEPS[currentStep]?.key === 'customer' && (
            <View>
              <View style={styles.stepHeader}>
                <LinearGradient colors={[COLORS.primary, '#1E40AF']} style={styles.stepIconGrad}>
                  <MaterialCommunityIcons name="account-plus" size={24} color="#FFF" />
                </LinearGradient>
                <View>
                  <Text style={styles.stepTitle}>კლიენტის ინფორმაცია</Text>
                  <Text style={styles.stepSubtitle}>ტელეფონი ავტომატურად ეძებს კლიენტს</Text>
                </View>
              </View>

              {/* Case Type Toggle */}
              <View style={styles.caseTypeRow}>
                <TouchableOpacity
                  style={[styles.caseTypeBtn, caseType === 'დაზღვევა' && styles.caseTypeBtnActive]}
                  onPress={() => setCaseType(caseType === 'დაზღვევა' ? null : 'დაზღვევა')}
                >
                  <MaterialCommunityIcons
                    name="shield-car"
                    size={18}
                    color={caseType === 'დაზღვევა' ? '#FFF' : '#3B82F6'}
                  />
                  <Text style={[styles.caseTypeTxt, caseType === 'დაზღვევა' && styles.caseTypeTxtActive]}>
                    დაზღვევა
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.caseTypeBtn, caseType === 'საცალო' && styles.caseTypeBtnActiveGreen]}
                  onPress={() => setCaseType(caseType === 'საცალო' ? null : 'საცალო')}
                >
                  <MaterialCommunityIcons
                    name="cash"
                    size={18}
                    color={caseType === 'საცალო' ? '#FFF' : COLORS.success}
                  />
                  <Text style={[styles.caseTypeTxt, caseType === 'საცალო' && styles.caseTypeTxtActive]}>
                    საცალო
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Phone */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>ტელეფონი</Text>
                <View style={styles.inputRow}>
                  <View style={styles.inputIconWrap}>
                    <MaterialCommunityIcons name="phone" size={20} color={COLORS.primary} />
                  </View>
                  <View style={styles.inputFlex}>
                    <InputField
                      value={customerPhone}
                      onChangeText={setCustomerPhone}
                      placeholder="+995 XXX XXX XXX"
                      keyboardType="phone-pad"
                    />
                  </View>
                  {searchingCustomer && (
                    <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />
                  )}
                  {customerFound && !searchingCustomer && (
                    <View style={styles.foundBadge}>
                      <MaterialCommunityIcons name="check-circle" size={18} color={COLORS.success} />
                    </View>
                  )}
                </View>
              </View>

              {/* Repeat customer banner */}
              {isRepeatCustomer && (
                <View style={styles.repeatBanner}>
                  <MaterialCommunityIcons name="account-check" size={18} color={COLORS.success} />
                  <Text style={styles.repeatText}>მუდმივი კლიენტი — მონაცემები ავტომატურად შეივსო</Text>
                </View>
              )}

              {/* Customer Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>სახელი</Text>
                <View style={styles.inputRow}>
                  <View style={styles.inputIconWrap}>
                    <MaterialCommunityIcons name="account" size={20} color={COLORS.primary} />
                  </View>
                  <View style={styles.inputFlex}>
                    <InputField
                      value={customerName}
                      onChangeText={setCustomerName}
                      placeholder="მაგ. გიორგი გიორგაძე"
                    />
                  </View>
                </View>
              </View>

              {/* Notes */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>შენიშვნა (არასავალდებულო)</Text>
                <View style={[styles.inputRow, { alignItems: 'flex-start' }]}>
                  <View style={[styles.inputIconWrap, { marginTop: 10 }]}>
                    <MaterialCommunityIcons name="note-text" size={20} color={COLORS.text.tertiary} />
                  </View>
                  <View style={styles.inputFlex}>
                    <InputField
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="დამატებითი ინფორმაცია..."
                      multiline
                    />
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ─── Step 2: Vehicle ─────────────────────────── */}
          {STEPS[currentStep]?.key === 'vehicle' && (
            <View>
              <View style={styles.stepHeader}>
                <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.stepIconGrad}>
                  <MaterialCommunityIcons name="car" size={24} color="#FFF" />
                </LinearGradient>
                <View>
                  <Text style={styles.stepTitle}>ავტომობილის ინფორმაცია</Text>
                  <Text style={styles.stepSubtitle}>სახელმწიფო ნომერი და მოდელი</Text>
                </View>
              </View>

              {/* Plate */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>სახელმწიფო ნომერი *</Text>
                <View style={styles.plateInputWrap}>
                  <View style={styles.plateFlag}>
                    <Text style={styles.plateFlagText}>GE</Text>
                  </View>
                  <View style={styles.inputFlex}>
                    <InputField
                      value={plate}
                      onChangeText={(t: string) => setPlate(t.toUpperCase())}
                      placeholder="AA-123-BB"
                      autoCapitalize="characters"
                      style={styles.plateInput}
                    />
                  </View>
                </View>
              </View>

              {/* Car Selector */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>მარკა და მოდელი</Text>
                <CarSelector
                  value={
                    carMakeId && carModelId
                      ? { makeId: carMakeId, makeName: carMake, modelId: carModelId, modelName: carModel }
                      : null
                  }
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

              {/* Quick Display */}
              {(carMake || plate) && (
                <View style={styles.vehiclePreview}>
                  <MaterialCommunityIcons name="car-side" size={28} color={COLORS.primary} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.vehiclePreviewTitle}>
                      {[carMake, carModel].filter(Boolean).join(' ') || 'ავტომობილი'}
                    </Text>
                    {plate ? <Text style={styles.vehiclePreviewPlate}>{plate}</Text> : null}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ─── Step 3: Services ────────────────────────── */}
          {STEPS[currentStep]?.key === 'services' && (
            <View>
              <View style={styles.stepHeader}>
                <LinearGradient colors={[COLORS.secondary, '#059669']} style={styles.stepIconGrad}>
                  <MaterialCommunityIcons name="wrench" size={24} color="#FFF" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>სერვისები და ნაწილები</Text>
                  <Text style={styles.stepSubtitle}>
                    არჩეულია {selectedServices.length} სერვისი • {formatCurrencyGEL(servicesTotal)}
                  </Text>
                </View>
              </View>

              {/* Category Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
                contentContainerStyle={styles.categoryContent}
              >
                <TouchableOpacity
                  style={[styles.catChip, !activeCategory && styles.catChipActive]}
                  onPress={() => setActiveCategory(null)}
                >
                  <Text style={[styles.catChipText, !activeCategory && styles.catChipTextActive]}>
                    ყველა
                  </Text>
                </TouchableOpacity>
                {Object.entries(CATEGORY_MAP).map(([key, cat]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.catChip,
                      activeCategory === key && { backgroundColor: cat.color },
                    ]}
                    onPress={() => setActiveCategory(activeCategory === key ? null : key)}
                  >
                    <MaterialCommunityIcons
                      name={cat.icon as any}
                      size={14}
                      color={activeCategory === key ? '#FFF' : cat.color}
                    />
                    <Text
                      style={[
                        styles.catChipText,
                        activeCategory === key && styles.catChipTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Search */}
              <View style={styles.searchRow}>
                <MaterialCommunityIcons name="magnify" size={20} color={COLORS.text.tertiary} />
                <InputField
                  value={serviceSearch}
                  onChangeText={setServiceSearch}
                  placeholder="სერვისის ძებნა..."
                  style={styles.searchInput}
                />
              </View>

              {/* Services List */}
              {loadingServices ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 32 }} />
              ) : (
                filteredServices.map(svc => {
                  const isSelected = selectedServices.some(s => s.key === svc.key);
                  const sel = selectedServices.find(s => s.key === svc.key);
                  const catInfo = CATEGORY_MAP[svc.category];
                  const hasItemDisc = sel && sel.discount > 0;
                  const priceEdited = sel && sel.customPrice !== sel.basePrice;
                  return (
                    <View key={svc.key}>
                      <TouchableOpacity
                        style={[styles.serviceRow, isSelected && styles.serviceRowSelected]}
                        onPress={() => toggleService(svc)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.serviceRowLeft}>
                          <View
                            style={[
                              styles.serviceCheck,
                              isSelected && { backgroundColor: catInfo?.color || COLORS.primary },
                            ]}
                          >
                            {isSelected && (
                              <MaterialCommunityIcons name="check" size={14} color="#FFF" />
                            )}
                          </View>
                          <View style={styles.serviceInfo}>
                            <Text style={styles.serviceNameKa}>{svc.nameKa}</Text>
                            <Text style={styles.serviceNameEn}>{svc.nameEn}</Text>
                          </View>
                        </View>
                        <View style={styles.serviceRowRight}>
                          {isSelected && sel ? (
                            <View style={styles.qtyControls}>
                              <TouchableOpacity
                                style={styles.qtyBtn}
                                onPress={() => updateServiceQty(svc.key, -0.5)}
                              >
                                <MaterialCommunityIcons name="minus" size={16} color={COLORS.text.secondary} />
                              </TouchableOpacity>
                              <TextInput
                                style={styles.qtyInput}
                                value={String(sel.quantity)}
                                onChangeText={(t) => updateServiceQtyDirect(svc.key, t)}
                                keyboardType="decimal-pad"
                                selectTextOnFocus
                              />
                              <TouchableOpacity
                                style={styles.qtyBtn}
                                onPress={() => updateServiceQty(svc.key, 0.5)}
                              >
                                <MaterialCommunityIcons name="plus" size={16} color={COLORS.primary} />
                              </TouchableOpacity>
                            </View>
                          ) : null}
                          <Text style={[styles.servicePrice, isSelected && { color: COLORS.primary, fontWeight: '800' }]}>
                            {formatCurrencyGEL(isSelected && sel ? sel.price : svc.basePrice)}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Expanded controls: editable price + per-item discount */}
                      {isSelected && sel && (
                        <View style={styles.serviceExpandedRow}>
                          {/* Unit Price */}
                          <View style={styles.serviceEditGroup}>
                            <Text style={styles.serviceEditLabel}>ფასი ₾</Text>
                            <View style={styles.serviceEditInputWrap}>
                              <TextInput
                                style={[styles.serviceEditInput, priceEdited && styles.serviceEditInputEdited]}
                                value={String(sel.customPrice)}
                                onChangeText={(t) => updateServiceCustomPrice(svc.key, t)}
                                keyboardType="decimal-pad"
                                selectTextOnFocus
                              />
                            </View>
                          </View>
                          {/* Discount */}
                          <View style={styles.serviceEditGroup}>
                            <Text style={styles.serviceEditLabel}>ფასდაკლ. %</Text>
                            <View style={styles.serviceEditInputWrap}>
                              <TextInput
                                style={[styles.serviceEditInput, hasItemDisc && styles.serviceEditInputDiscount]}
                                value={sel.discount > 0 ? String(sel.discount) : ''}
                                onChangeText={(t) => updateServiceDiscount(svc.key, t)}
                                placeholder="0"
                                placeholderTextColor={COLORS.text.disabled}
                                keyboardType="decimal-pad"
                                selectTextOnFocus
                              />
                              {hasItemDisc && (
                                <MaterialCommunityIcons name="tag-outline" size={14} color={COLORS.secondary} style={{ position: 'absolute', right: 6 }} />
                              )}
                            </View>
                          </View>
                          {/* Saved display */}
                          {hasItemDisc && (
                            <View style={styles.serviceEditSaved}>
                              <MaterialCommunityIcons name="arrow-down" size={12} color={COLORS.secondary} />
                              <Text style={styles.serviceEditSavedText}>
                                -{formatCurrencyGEL(sel.customPrice * sel.quantity * sel.discount / 100)}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}

              {/* Parts Section */}
              <View style={styles.partsSectionHeader}>
                <MaterialCommunityIcons name="cog" size={18} color={COLORS.accent} />
                <Text style={styles.partsTitle}>ნაწილები</Text>
                <TouchableOpacity
                  style={styles.addPartBtn}
                  onPress={() => setShowPartForm(!showPartForm)}
                >
                  <MaterialCommunityIcons name={showPartForm ? 'close' : 'plus'} size={18} color={COLORS.accent} />
                </TouchableOpacity>
              </View>

              {showPartForm && (
                <View style={styles.partForm}>
                  <InputField
                    value={partNameKa}
                    onChangeText={setPartNameKa}
                    placeholder="ნაწილის სახელი"
                  />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <View style={{ flex: 1 }}>
                      <InputField
                        value={partQty}
                        onChangeText={setPartQty}
                        placeholder="რაოდ."
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={{ flex: 2 }}>
                      <InputField
                        value={partPrice}
                        onChangeText={setPartPrice}
                        placeholder="ფასი ₾"
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <TouchableOpacity style={styles.addPartConfirmBtn} onPress={addPart}>
                      <MaterialCommunityIcons name="check" size={22} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {parts.map(p => {
                const partLineTotal = p.unitPrice * p.quantity;
                const partAfterDisc = partLineTotal * (1 - (p.discount || 0) / 100);
                const partHasDisc = p.discount > 0;
                return (
                  <View key={p.id} style={styles.partRow}>
                    <View style={styles.partRowTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.partName}>{p.nameKa}</Text>
                        <Text style={styles.partMeta}>{p.quantity} × {formatCurrencyGEL(p.unitPrice)}</Text>
                      </View>
                      <View style={styles.partRowRight}>
                        <Text style={[styles.partTotal, partHasDisc && { textDecorationLine: 'line-through', color: COLORS.text.disabled, fontSize: 11 }]}>
                          {formatCurrencyGEL(partLineTotal)}
                        </Text>
                        {partHasDisc && (
                          <Text style={[styles.partTotal, { color: COLORS.secondary }]}>
                            {formatCurrencyGEL(partAfterDisc)}
                          </Text>
                        )}
                        <TouchableOpacity onPress={() => removePart(p.id)}>
                          <MaterialCommunityIcons name="close-circle" size={20} color={COLORS.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {/* Per-part discount */}
                    <View style={styles.partDiscountRow}>
                      <MaterialCommunityIcons name="tag-outline" size={14} color={COLORS.text.tertiary} />
                      <Text style={styles.partDiscountLabel}>ფასდაკლება %</Text>
                      <TextInput
                        style={[styles.partDiscountInput, partHasDisc && styles.serviceEditInputDiscount]}
                        value={p.discount > 0 ? String(p.discount) : ''}
                        onChangeText={(t) => updatePartDiscount(p.id, t)}
                        placeholder="0"
                        placeholderTextColor={COLORS.text.disabled}
                        keyboardType="decimal-pad"
                        selectTextOnFocus
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ─── Step 4: Photos ──────────────────────────── */}
          {STEPS[currentStep]?.key === 'photos' && (
            <View>
              <View style={styles.stepHeader}>
                <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.stepIconGrad}>
                  <MaterialCommunityIcons name="camera" size={24} color="#FFF" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>ფოტოები და მონიშვნა</Text>
                  <Text style={styles.stepSubtitle}>
                    {photos.length} ფოტო{totalPhotoTags > 0 ? ` • ${totalPhotoTags} ტეგი` : ''} — შეგიძლიათ მოგვიანებით
                  </Text>
                </View>
              </View>

              {/* Photo Actions */}
              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.photoActionBtn} onPress={takePhoto}>
                  <LinearGradient colors={[COLORS.primary, '#1E40AF']} style={styles.photoActionGrad}>
                    <MaterialCommunityIcons name="camera" size={28} color="#FFF" />
                  </LinearGradient>
                  <Text style={styles.photoActionLabel}>კამერა</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoActionBtn} onPress={pickPhotos}>
                  <LinearGradient colors={[COLORS.accent, '#7C3AED']} style={styles.photoActionGrad}>
                    <MaterialCommunityIcons name="image-multiple" size={28} color="#FFF" />
                  </LinearGradient>
                  <Text style={styles.photoActionLabel}>გალერეა</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoActionBtn}
                  onPress={() => router.push('/capture/QuickCaptureScreen')}
                >
                  <LinearGradient colors={[COLORS.secondary, '#059669']} style={styles.photoActionGrad}>
                    <MaterialCommunityIcons name="camera-burst" size={28} color="#FFF" />
                  </LinearGradient>
                  <Text style={styles.photoActionLabel}>Quick Capture</Text>
                </TouchableOpacity>
              </View>

              {/* Tagging hint */}
              {photos.length > 0 && (
                <View style={styles.taggingHint}>
                  <MaterialCommunityIcons name="gesture-tap" size={18} color={COLORS.primary} />
                  <Text style={styles.taggingHintText}>
                    შეეხეთ ფოტოს დაზიანების მონიშვნისთვის
                  </Text>
                </View>
              )}

              {/* Photo Grid */}
              {photos.length > 0 ? (
                <View style={styles.photoGrid}>
                  {photos.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.photoCard}
                      activeOpacity={0.8}
                      onPress={() => openTagging(p)}
                    >
                      <Image source={{ uri: p.uri }} style={styles.photoImage} />
                      {/* Remove btn */}
                      <TouchableOpacity
                        style={styles.photoRemoveBtn}
                        onPress={() => removePhoto(p.id)}
                      >
                        <MaterialCommunityIcons name="close-circle" size={22} color={COLORS.error} />
                      </TouchableOpacity>
                      {/* Tag badge */}
                      {p.tags && p.tags.length > 0 && (
                        <View style={styles.photoTagBadge}>
                          <MaterialCommunityIcons name="map-marker" size={10} color="#FFF" />
                          <Text style={styles.photoTagBadgeText}>{p.tags.length}</Text>
                        </View>
                      )}
                      {/* Tag icon overlay */}
                      <View style={styles.photoTagOverlay}>
                        <MaterialCommunityIcons
                          name="map-marker-plus"
                          size={16}
                          color="#FFF"
                        />
                      </View>
                      <View style={styles.photoLabel}>
                        <Text style={styles.photoLabelText}>{p.label}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyPhotos}>
                  <MaterialCommunityIcons name="image-off-outline" size={48} color={COLORS.text.disabled} />
                  <Text style={styles.emptyPhotosText}>ფოტოები ჯერ არ არის დამატებული</Text>
                  <Text style={styles.emptyPhotosSub}>შეგიძლიათ გამოტოვოთ ეს ნაბიჯი</Text>
                </View>
              )}
            </View>
          )}

          {/* ═══ Photo Tagging Modal ══════════════════════════ */}
          <Modal
            visible={showTaggingModal}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={closeTagging}
          >
            <View style={styles.tagModalContainer}>
              {/* Header */}
              <View style={styles.tagModalHeader}>
                <TouchableOpacity onPress={closeTagging} style={styles.tagModalCloseBtn}>
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.text.primary} />
                </TouchableOpacity>
                <View style={styles.tagModalHeaderCenter}>
                  <Text style={styles.tagModalTitle}>დაზიანების მონიშვნა</Text>
                  <Text style={styles.tagModalSubtitle}>
                    შეეხეთ ფოტოს ტეგის დასამატებლად
                  </Text>
                </View>
                <View style={styles.tagModalTagCount}>
                  <Text style={styles.tagModalTagCountText}>
                    {taggingPhoto?.tags.length || 0}
                  </Text>
                </View>
              </View>

              {/* Image with tags */}
              {taggingPhoto && (
                <View style={styles.tagModalImageWrap}>
                  <TouchableOpacity
                    activeOpacity={0.95}
                    onPress={handleTagImagePress}
                    style={styles.tagModalImageTouch}
                  >
                    <Image
                      source={{ uri: taggingPhoto.uri }}
                      style={styles.tagModalImage}
                      resizeMode="contain"
                      onLayout={(e) => {
                        const { width: w, height: h } = e.nativeEvent.layout;
                        setTagImageLayout({ width: w, height: h });
                      }}
                    />
                    {/* Existing tags — draggable */}
                    {taggingPhoto.tags.map(tag => {
                      const panResponder = getTagPanResponder(tag);
                      const isDragging = draggingTagId === tag.id;
                      return (
                        <View
                          key={tag.id}
                          {...panResponder.panHandlers}
                          style={[
                            styles.tagMarker,
                            { left: `${tag.x}%`, top: `${tag.y}%` },
                            isDragging && styles.tagMarkerDragging,
                          ]}
                        >
                          <MaterialCommunityIcons name="map-marker" size={isDragging ? 34 : 28} color={isDragging ? COLORS.primary : COLORS.error} />
                          <View style={[styles.tagMarkerLabel, isDragging && styles.tagMarkerLabelDragging]}>
                            <Text style={styles.tagMarkerLabelText} numberOfLines={1}>
                              {tag.serviceNameKa}
                            </Text>
                          </View>
                          {!isDragging && (
                            <TouchableOpacity
                              style={styles.tagDeleteBtn}
                              onPress={() => removeTag(tag.id)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <MaterialCommunityIcons name="close-circle" size={16} color="rgba(255,255,255,0.8)" />
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                    {/* Pending tag position marker */}
                    {pendingTagPos && (
                      <View
                        style={[
                          styles.tagMarkerPending,
                          { left: `${pendingTagPos.x}%`, top: `${pendingTagPos.y}%` },
                        ]}
                      >
                        <MaterialCommunityIcons name="plus-circle" size={32} color={COLORS.primary} />
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Service picker overlay */}
              {showServicePicker && (
                <View style={styles.tagServicePicker}>
                  <View style={styles.tagServicePickerHeader}>
                    <MaterialCommunityIcons name="wrench" size={18} color={COLORS.primary} />
                    <Text style={styles.tagServicePickerTitle}>აირჩიეთ სერვისი</Text>
                    <TouchableOpacity onPress={() => { setPendingTagPos(null); setShowServicePicker(false); }}>
                      <MaterialCommunityIcons name="close" size={20} color={COLORS.text.tertiary} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={styles.tagServiceList} showsVerticalScrollIndicator={false}>
                    {/* Selected services first */}
                    {selectedServices.length > 0 && (
                      <View>
                        <Text style={styles.tagServiceGroupLabel}>არჩეული სერვისები</Text>
                        {selectedServices.map(svc => (
                          <TouchableOpacity
                            key={svc.key}
                            style={styles.tagServiceOption}
                            onPress={() => assignServiceToTag(svc)}
                          >
                            <View style={[styles.tagServiceDot, { backgroundColor: COLORS.secondary }]} />
                            <View style={styles.tagServiceOptionInfo}>
                              <Text style={styles.tagServiceOptionName}>{svc.nameKa}</Text>
                              <Text style={styles.tagServiceOptionSub}>{svc.nameEn}</Text>
                            </View>
                            <Text style={styles.tagServiceOptionPrice}>{formatCurrencyGEL(svc.basePrice)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {/* All available services */}
                    <Text style={styles.tagServiceGroupLabel}>ყველა სერვისი</Text>
                    {availableServices.map(svc => (
                      <TouchableOpacity
                        key={svc.key}
                        style={styles.tagServiceOption}
                        onPress={() => assignServiceToTag(svc)}
                      >
                        <View style={[styles.tagServiceDot, { backgroundColor: COLORS.text.tertiary }]} />
                        <View style={styles.tagServiceOptionInfo}>
                          <Text style={styles.tagServiceOptionName}>{svc.nameKa}</Text>
                          <Text style={styles.tagServiceOptionSub}>{svc.nameEn}</Text>
                        </View>
                        <Text style={styles.tagServiceOptionPrice}>{formatCurrencyGEL(svc.basePrice)}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Tag list at bottom */}
              {taggingPhoto && taggingPhoto.tags.length > 0 && !showServicePicker && (
                <View style={styles.tagListSection}>
                  <Text style={styles.tagListTitle}>მონიშნული დაზიანებები ({taggingPhoto.tags.length})</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {taggingPhoto.tags.map(tag => (
                      <View key={tag.id} style={styles.tagListChip}>
                        <MaterialCommunityIcons name="map-marker" size={14} color={COLORS.error} />
                        <Text style={styles.tagListChipText} numberOfLines={1}>{tag.serviceNameKa}</Text>
                        <TouchableOpacity onPress={() => removeTag(tag.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <MaterialCommunityIcons name="close-circle" size={16} color={COLORS.text.tertiary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </Modal>

          {/* ─── Step 5: Review ──────────────────────────── */}
          {STEPS[currentStep]?.key === 'review' && (
            <View>
              <View style={styles.stepHeader}>
                <LinearGradient colors={[COLORS.success, '#059669']} style={styles.stepIconGrad}>
                  <MaterialCommunityIcons name="check-circle" size={24} color="#FFF" />
                </LinearGradient>
                <View>
                  <Text style={styles.stepTitle}>საქმის შეჯამება</Text>
                  <Text style={styles.stepSubtitle}>გადაამოწმეთ და შეინახეთ</Text>
                </View>
              </View>

              {/* Customer Summary */}
              <View style={styles.reviewCard}>
                <View style={styles.reviewCardHeader}>
                  <MaterialCommunityIcons name="account" size={18} color={COLORS.primary} />
                  <Text style={styles.reviewCardTitle}>კლიენტი</Text>
                </View>
                <Text style={styles.reviewValue}>{customerName || '—'}</Text>
                <Text style={styles.reviewSub}>{customerPhone || '—'}</Text>
                {caseType && (
                  <View style={[styles.reviewChip, { backgroundColor: caseType === 'დაზღვევა' ? '#2196F318' : '#10B98118' }]}>
                    <Text style={[styles.reviewChipText, { color: caseType === 'დაზღვევა' ? '#2196F3' : COLORS.success }]}>
                      {caseType}
                    </Text>
                  </View>
                )}
              </View>

              {/* Vehicle Summary */}
              <View style={styles.reviewCard}>
                <View style={styles.reviewCardHeader}>
                  <MaterialCommunityIcons name="car" size={18} color="#6366F1" />
                  <Text style={styles.reviewCardTitle}>ავტომობილი</Text>
                </View>
                <Text style={styles.reviewValue}>
                  {[carMake, carModel].filter(Boolean).join(' ') || '—'}
                </Text>
                <Text style={styles.reviewPlate}>{plate || '—'}</Text>
              </View>

              {/* Services Summary */}
              <View style={styles.reviewCard}>
                <View style={styles.reviewCardHeader}>
                  <MaterialCommunityIcons name="wrench" size={18} color={COLORS.secondary} />
                  <Text style={styles.reviewCardTitle}>სერვისები ({selectedServices.length})</Text>
                  <Text style={styles.reviewTotal}>{formatCurrencyGEL(servicesTotal)}</Text>
                </View>
                {selectedServices.map(s => (
                  <View key={s.key} style={styles.reviewServiceRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewServiceName}>
                        {s.nameKa} {s.quantity !== 1 ? `×${s.quantity}` : ''}
                        {s.customPrice !== s.basePrice ? ` (₾${s.customPrice})` : ''}
                      </Text>
                      {s.discount > 0 && (
                        <Text style={{ fontSize: 11, color: COLORS.secondary, marginTop: 1 }}>
                          ფასდაკლება: {s.discount}%  •  -{formatCurrencyGEL(s.customPrice * s.quantity * s.discount / 100)}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.reviewServicePrice}>{formatCurrencyGEL(s.price)}</Text>
                  </View>
                ))}
              </View>

              {/* Parts Summary */}
              {parts.length > 0 && (
                <View style={styles.reviewCard}>
                  <View style={styles.reviewCardHeader}>
                    <MaterialCommunityIcons name="cog" size={18} color={COLORS.accent} />
                    <Text style={styles.reviewCardTitle}>ნაწილები ({parts.length})</Text>
                    <Text style={styles.reviewTotal}>{formatCurrencyGEL(partsTotal)}</Text>
                  </View>
                  {parts.map(p => {
                    const pLine = p.unitPrice * p.quantity;
                    const pAfter = pLine * (1 - (p.discount || 0) / 100);
                    return (
                      <View key={p.id} style={styles.reviewServiceRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reviewServiceName}>
                            {p.nameKa} {p.quantity !== 1 ? `×${p.quantity}` : ''}
                          </Text>
                          {p.discount > 0 && (
                            <Text style={{ fontSize: 11, color: COLORS.secondary, marginTop: 1 }}>
                              ფასდაკლება: {p.discount}%  •  -{formatCurrencyGEL(pLine * p.discount / 100)}
                            </Text>
                          )}
                        </View>
                        <Text style={styles.reviewServicePrice}>{formatCurrencyGEL(pAfter)}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Photos Summary */}
              {photos.length > 0 && (
                <View style={styles.reviewCard}>
                  <View style={styles.reviewCardHeader}>
                    <MaterialCommunityIcons name="camera" size={18} color={COLORS.warning} />
                    <Text style={styles.reviewCardTitle}>ფოტოები ({photos.length})</Text>
                    {totalPhotoTags > 0 && (
                      <View style={styles.reviewTagBadge}>
                        <MaterialCommunityIcons name="map-marker" size={12} color={COLORS.error} />
                        <Text style={styles.reviewTagBadgeText}>{totalPhotoTags} ტეგი</Text>
                      </View>
                    )}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {photos.map(p => (
                      <View key={p.id} style={styles.reviewPhotoWrap}>
                        <Image source={{ uri: p.uri }} style={styles.reviewPhoto} />
                        {p.tags && p.tags.length > 0 && (
                          <View style={styles.reviewPhotoTagBadge}>
                            <Text style={styles.reviewPhotoTagBadgeText}>{p.tags.length}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Discount Section */}
              <TouchableOpacity
                style={[styles.discountToggle, showDiscounts && styles.discountToggleActive]}
                onPress={() => setShowDiscounts(!showDiscounts)}
              >
                <MaterialCommunityIcons
                  name="sale"
                  size={20}
                  color={hasAnyDiscount ? COLORS.error : COLORS.text.tertiary}
                />
                <Text style={styles.discountToggleText}>ფასდაკლება</Text>
                {hasAnyDiscount && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>-{formatCurrencyGEL(totalDiscountAmount)}</Text>
                  </View>
                )}
                <MaterialCommunityIcons
                  name={showDiscounts ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={COLORS.text.tertiary}
                />
              </TouchableOpacity>

              {showDiscounts && (
                <View style={styles.discountPanel}>
                  {/* Services Discount */}
                  <View style={styles.discountRow}>
                    <View style={styles.discountLabelRow}>
                      <MaterialCommunityIcons name="wrench" size={16} color={COLORS.secondary} />
                      <Text style={styles.discountLabel}>სერვისები</Text>
                      {svcDiscPct > 0 && (
                        <Text style={styles.discountSaved}>-{formatCurrencyGEL(servicesRaw * svcDiscPct / 100)}</Text>
                      )}
                    </View>
                    <View style={styles.discountInputWrap}>
                      <TextInput
                        value={servicesDiscount}
                        onChangeText={setServicesDiscount}
                        placeholder="0"
                        placeholderTextColor={COLORS.text.disabled}
                        keyboardType="decimal-pad"
                        style={styles.discountInput}
                        maxLength={5}
                      />
                      <Text style={styles.discountPctSign}>%</Text>
                    </View>
                  </View>

                  {/* Parts Discount */}
                  <View style={styles.discountRow}>
                    <View style={styles.discountLabelRow}>
                      <MaterialCommunityIcons name="cog" size={16} color={COLORS.accent} />
                      <Text style={styles.discountLabel}>ნაწილები</Text>
                      {prtDiscPct > 0 && (
                        <Text style={styles.discountSaved}>-{formatCurrencyGEL(partsRaw * prtDiscPct / 100)}</Text>
                      )}
                    </View>
                    <View style={styles.discountInputWrap}>
                      <TextInput
                        value={partsDiscount}
                        onChangeText={setPartsDiscount}
                        placeholder="0"
                        placeholderTextColor={COLORS.text.disabled}
                        keyboardType="decimal-pad"
                        style={styles.discountInput}
                        maxLength={5}
                      />
                      <Text style={styles.discountPctSign}>%</Text>
                    </View>
                  </View>

                  {/* Global Discount */}
                  <View style={[styles.discountRow, styles.discountRowLast]}>
                    <View style={styles.discountLabelRow}>
                      <MaterialCommunityIcons name="tag-multiple" size={16} color={COLORS.error} />
                      <Text style={[styles.discountLabel, { fontWeight: '700' }]}>საერთო</Text>
                      {glbDiscPct > 0 && (
                        <Text style={styles.discountSaved}>-{formatCurrencyGEL(subtotalBeforeGlobal * glbDiscPct / 100)}</Text>
                      )}
                    </View>
                    <View style={styles.discountInputWrap}>
                      <TextInput
                        value={globalDiscount}
                        onChangeText={setGlobalDiscount}
                        placeholder="0"
                        placeholderTextColor={COLORS.text.disabled}
                        keyboardType="decimal-pad"
                        style={styles.discountInput}
                        maxLength={5}
                      />
                      <Text style={styles.discountPctSign}>%</Text>
                    </View>
                  </View>

                  {/* Quick Discount Chips */}
                  <View style={styles.quickDiscountRow}>
                    {[5, 10, 15, 20].map(pct => (
                      <TouchableOpacity
                        key={pct}
                        style={[
                          styles.quickDiscountChip,
                          glbDiscPct === pct && styles.quickDiscountChipActive,
                        ]}
                        onPress={() => setGlobalDiscount(glbDiscPct === pct ? '' : String(pct))}
                      >
                        <Text style={[
                          styles.quickDiscountChipText,
                          glbDiscPct === pct && styles.quickDiscountChipTextActive,
                        ]}>
                          {pct}%
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

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
                <Text style={styles.vatToggleText}>დღგ +18%</Text>
                {includeVAT && (
                  <Text style={styles.vatAmountText}>+{formatCurrencyGEL(vatAmount)}</Text>
                )}
              </TouchableOpacity>

              {/* Grand Total */}
              <LinearGradient
                colors={[COLORS.primary, '#1E40AF']}
                style={styles.grandTotalCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.grandTotalLabel}>საბოლოო თანხა</Text>
                  {(hasAnyDiscount || includeVAT) && (
                    <Text style={styles.grandTotalSub}>
                      {hasAnyDiscount ? `ფასდაკლება: -${formatCurrencyGEL(totalDiscountAmount)}` : ''}
                      {hasAnyDiscount && includeVAT ? ' • ' : ''}
                      {includeVAT ? `დღგ: +${formatCurrencyGEL(vatAmount)}` : ''}
                    </Text>
                  )}
                </View>
                <Text style={styles.grandTotalAmount}>{formatCurrencyGEL(grandTotal)}</Text>
              </LinearGradient>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* ─── Bottom Navigation ────────────────────────────── */}
      <View style={styles.bottomBar}>
        {currentStep > 0 ? (
          <TouchableOpacity style={styles.backBtn} onPress={goBack}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={COLORS.text.secondary} />
            <Text style={styles.backBtnText}>უკან</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="close" size={20} color={COLORS.text.secondary} />
            <Text style={styles.backBtnText}>გაუქმება</Text>
          </TouchableOpacity>
        )}

        {/* Live total pill */}
        {grandTotal > 0 && currentStep < STEPS.length - 1 && (
          <View style={styles.totalPill}>
            <Text style={styles.totalPillText}>{formatCurrencyGEL(grandTotal)}</Text>
          </View>
        )}

        {currentStep < STEPS.length - 1 ? (
          <TouchableOpacity
            style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
            onPress={goNext}
            disabled={!canProceed()}
          >
            <Text style={styles.nextBtnText}>შემდეგი</Text>
            <MaterialCommunityIcons name="arrow-right" size={20} color="#FFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="content-save" size={20} color="#FFF" />
                <Text style={styles.saveBtnText}>შენახვა</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Input Field Component ──────────────────────────────────
function InputField({ value, onChangeText, placeholder, keyboardType, style, autoCapitalize, multiline }: any) {
  return (
    <View style={[iStyles.inputWrap, style]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.text.disabled}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        style={[iStyles.input, multiline && { minHeight: 60, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Progress Bar ──────────────────────────────────────────
  progressBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
  },
  progressStep: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.outline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  progressDotActive: {
    backgroundColor: COLORS.primary,
  },
  progressDotDone: {
    backgroundColor: COLORS.success,
  },
  progressLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.text.disabled,
    textAlign: 'center',
  },
  progressLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  progressLabelDone: {
    color: COLORS.success,
  },
  progressLine: {
    position: 'absolute',
    top: 14,
    left: '60%',
    right: '-40%',
    height: 2,
    backgroundColor: COLORS.outline,
  },
  progressLineFilled: {
    backgroundColor: COLORS.success,
  },

  // ── Step Content ──────────────────────────────────────────
  stepContent: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // ── Step Header ───────────────────────────────────────────
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  stepIconGrad: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  stepSubtitle: {
    fontSize: 13,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },

  // ── Case Type ─────────────────────────────────────────────
  caseTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  caseTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.outline,
    backgroundColor: COLORS.surface,
  },
  caseTypeBtnActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  caseTypeBtnActiveGreen: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  caseTypeTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  caseTypeTxtActive: {
    color: '#FFF',
  },

  // ── Field Group ───────────────────────────────────────────
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: 6,
    marginLeft: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.outline,
    paddingHorizontal: 4,
  },
  inputIconWrap: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputFlex: {
    flex: 1,
  },
  foundBadge: {
    marginRight: 8,
  },

  // ── Repeat Banner ─────────────────────────────────────────
  repeatBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#10B98115',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  repeatText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
    flex: 1,
  },

  // ── Plate Input ───────────────────────────────────────────
  plateInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.outline,
    overflow: 'hidden',
  },
  plateFlag: {
    width: 44,
    height: 48,
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateFlagText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
  plateInput: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
  },

  // ── Vehicle Preview ───────────────────────────────────────
  vehiclePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '08',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
    marginTop: 8,
  },
  vehiclePreviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  vehiclePreviewPlate: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 2,
  },

  // ── Categories ────────────────────────────────────────────
  categoryScroll: {
    marginBottom: 12,
    maxHeight: 40,
  },
  categoryContent: {
    gap: 8,
    paddingRight: 16,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  catChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  catChipTextActive: {
    color: '#FFF',
  },

  // ── Search ────────────────────────────────────────────────
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.outline,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },

  // ── Services ──────────────────────────────────────────────
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  serviceRowSelected: {
    borderColor: COLORS.primary + '40',
    backgroundColor: COLORS.primary + '06',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
  },
  serviceRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  serviceCheck: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceNameKa: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  serviceNameEn: {
    fontSize: 11,
    color: COLORS.text.tertiary,
    marginTop: 1,
  },
  serviceRowRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text.primary,
    minWidth: 18,
    textAlign: 'center',
  },
  qtyInput: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text.primary,
    minWidth: 30,
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary + '40',
  },
  servicePrice: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },

  // ── Expanded Service Controls ─────────────────────────────
  serviceExpandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '06',
    marginTop: -6,
    marginBottom: 6,
    borderRadius: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: COLORS.primary + '20',
    gap: 10,
    flexWrap: 'wrap',
  },
  serviceEditGroup: {
    gap: 3,
  },
  serviceEditLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  serviceEditInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  serviceEditInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.outline,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    minWidth: 70,
    textAlign: 'center',
  },
  serviceEditInputEdited: {
    borderColor: COLORS.primary + '60',
    backgroundColor: COLORS.primary + '08',
  },
  serviceEditInputDiscount: {
    borderColor: COLORS.secondary + '60',
    backgroundColor: COLORS.secondary + '08',
  },
  serviceEditSaved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.secondary + '15',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  serviceEditSavedText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
  },

  // ── Parts Section ─────────────────────────────────────────
  partsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 12,
  },
  partsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
    flex: 1,
  },
  addPartBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partForm: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.accent + '30',
  },
  addPartConfirmBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  partRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  partName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  partMeta: {
    fontSize: 11,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  partRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  partTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.accent,
  },
  partDiscountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline + '60',
  },
  partDiscountLabel: {
    fontSize: 11,
    color: COLORS.text.tertiary,
    fontWeight: '600',
  },
  partDiscountInput: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.outline,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.primary,
    minWidth: 50,
    textAlign: 'center',
  },

  // ── Photos ────────────────────────────────────────────────
  photoActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  photoActionBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  photoActionGrad: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  photoActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoCard: {
    width: (width - 48) / 3,
    height: (width - 48) / 3,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceVariant,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 11,
  },
  photoLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
  },
  photoLabelText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyPhotos: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyPhotosText: {
    fontSize: 14,
    color: COLORS.text.disabled,
    fontWeight: '500',
  },
  emptyPhotosSub: {
    fontSize: 12,
    color: COLORS.text.disabled,
  },

  // ── Photo Tagging ─────────────────────────────────────────
  taggingHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary + '10',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
  },
  taggingHintText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    flex: 1,
  },
  photoTagBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
    zIndex: 2,
  },
  photoTagBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
  },
  photoTagOverlay: {
    position: 'absolute',
    bottom: 24,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Tagging Modal ─────────────────────────────────────────
  tagModalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tagModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
    gap: 12,
  },
  tagModalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagModalHeaderCenter: {
    flex: 1,
  },
  tagModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  tagModalSubtitle: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    marginTop: 1,
  },
  tagModalTagCount: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagModalTagCountText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  tagModalImageWrap: {
    flex: 1,
    backgroundColor: '#111',
    position: 'relative',
  },
  tagModalImageTouch: {
    flex: 1,
    position: 'relative',
  },
  tagModalImage: {
    width: '100%',
    height: '100%',
  },

  // ── Tag Markers ───────────────────────────────────────────
  tagMarker: {
    position: 'absolute',
    transform: [{ translateX: -14 }, { translateY: -28 }],
    alignItems: 'center',
    zIndex: 10,
  },
  tagMarkerDragging: {
    zIndex: 100,
    opacity: 0.9,
    transform: [{ translateX: -17 }, { translateY: -34 }, { scale: 1.15 }],
  },
  tagMarkerLabel: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: -2,
    maxWidth: 120,
  },
  tagMarkerLabelDragging: {
    backgroundColor: COLORS.primary,
  },
  tagMarkerLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFF',
  },
  tagDeleteBtn: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
  },
  tagMarkerPending: {
    position: 'absolute',
    transform: [{ translateX: -16 }, { translateY: -16 }],
    zIndex: 15,
  },

  // ── Service Picker ────────────────────────────────────────
  tagServicePicker: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '50%',
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...SHADOWS.lg,
  },
  tagServicePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
  },
  tagServicePickerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  tagServiceList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  tagServiceGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  tagServiceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.outline,
  },
  tagServiceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tagServiceOptionInfo: {
    flex: 1,
  },
  tagServiceOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  tagServiceOptionSub: {
    fontSize: 11,
    color: COLORS.text.tertiary,
  },
  tagServiceOptionPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // ── Tag List ──────────────────────────────────────────────
  tagListSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  tagListTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text.secondary,
    marginBottom: 8,
  },
  tagListChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.error + '10',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.error + '20',
  },
  tagListChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.primary,
    maxWidth: 100,
  },

  // ── Review Tags ───────────────────────────────────────────
  reviewTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.error + '12',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  reviewTagBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.error,
  },
  reviewPhotoWrap: {
    position: 'relative',
  },
  reviewPhotoTagBadge: {
    position: 'absolute',
    top: 6,
    right: 2,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  reviewPhotoTagBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
  },

  // ── Review ────────────────────────────────────────────────
  reviewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    ...SHADOWS.sm,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  reviewCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text.primary,
    flex: 1,
  },
  reviewTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  reviewValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginLeft: 26,
  },
  reviewSub: {
    fontSize: 13,
    color: COLORS.text.tertiary,
    marginLeft: 26,
    marginTop: 2,
  },
  reviewPlate: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 26,
    marginTop: 2,
  },
  reviewChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 26,
    marginTop: 6,
  },
  reviewChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reviewServiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginLeft: 22,
  },
  reviewServiceName: {
    fontSize: 13,
    color: COLORS.text.secondary,
    flex: 1,
  },
  reviewServicePrice: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  reviewPhoto: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 8,
    marginTop: 4,
  },

  // ── Discounts ─────────────────────────────────────────────
  discountToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  discountToggleActive: {
    borderColor: COLORS.error + '40',
    backgroundColor: COLORS.error + '06',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
  },
  discountToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    flex: 1,
  },
  discountBadge: {
    backgroundColor: COLORS.error + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  discountBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.error,
  },
  discountPanel: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: COLORS.error + '40',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
  },
  discountRowLast: {
    borderBottomWidth: 0,
  },
  discountLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  discountLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  discountSaved: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.error,
    marginLeft: 4,
  },
  discountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.outline,
    paddingHorizontal: 8,
    width: 80,
  },
  discountInput: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text.primary,
    paddingVertical: 6,
    flex: 1,
    textAlign: 'center',
  },
  discountPctSign: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.tertiary,
  },
  quickDiscountRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    justifyContent: 'center',
  },
  quickDiscountChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  quickDiscountChipActive: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
  },
  quickDiscountChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  quickDiscountChipTextActive: {
    color: '#FFF',
  },

  // ── VAT Toggle ────────────────────────────────────────────
  vatToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  vatToggleActive: {
    borderColor: COLORS.primary + '40',
    backgroundColor: COLORS.primary + '06',
  },
  vatToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    flex: 1,
  },
  vatAmountText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // ── Grand Total ───────────────────────────────────────────
  grandTotalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: 20,
    marginTop: 4,
    marginBottom: 8,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  grandTotalSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  grandTotalAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
  },

  // ── Bottom Bar ────────────────────────────────────────────
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
    ...SHADOWS.md,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.background,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  totalPill: {
    backgroundColor: COLORS.primary + '12',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  totalPillText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  nextBtnDisabled: {
    opacity: 0.4,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.success,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});

const iStyles = StyleSheet.create({
  inputWrap: {},
  inputInner: {},
  input: {
    fontSize: 15,
    color: COLORS.text.primary,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
});
