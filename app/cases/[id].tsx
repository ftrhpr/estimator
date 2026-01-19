import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Image,
    Linking,
    Modal,
    ScrollView,
    Share,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { GestureHandlerRootView, PinchGestureHandler, State } from 'react-native-gesture-handler';
import {
    ActivityIndicator,
    Button,
    Card,
    Checkbox,
    Divider,
    IconButton,
    Portal,
    Surface,
    Text,
    TextInput
} from 'react-native-paper';
import Reanimated, {
    useSharedValue,
    withSpring
} from 'react-native-reanimated';

import { CarSelector, SelectedCar } from '../../src/components/common/CarSelector';
import { COLORS } from '../../src/config/constants';
import { DEFAULT_SERVICES } from '../../src/config/services';
import { fetchInvoiceFromCPanel } from '../../src/services/cpanelService';
import { ServiceService } from '../../src/services/serviceService';
import { formatCurrencyGEL } from '../../src/utils/helpers';

const { width, height } = Dimensions.get('window');

export const options = ({ params }: { params?: { id?: string } }) => {
  const id = params?.id;
  return {
    title: id ? `Invoice #${id.toString().slice(0, 8).toUpperCase()}` : 'Case',
  };
};

export default function CaseDetailScreen() {
  const { id, source } = useLocalSearchParams();
  const isCpanelOnly = source === 'cpanel';
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedServices, setEditedServices] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(-1);
  const [showImageModal, setShowImageModal] = useState(false);
  const [editCustomerMode, setEditCustomerMode] = useState(false);
  const [editedCustomerName, setEditedCustomerName] = useState('');
  const [editedCustomerPhone, setEditedCustomerPhone] = useState('');
  const [editedCarMake, setEditedCarMake] = useState('');
  const [editedCarModel, setEditedCarModel] = useState('');
  const [editedCarMakeId, setEditedCarMakeId] = useState('');
  const [editedCarModelId, setEditedCarModelId] = useState('');
  const [editedPlate, setEditedPlate] = useState('');
  const [showCarSelector, setShowCarSelector] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceCount, setNewServiceCount] = useState('1');
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const [actualImageSize, setActualImageSize] = useState({ width: 0, height: 0 });
  const [cpanelInvoiceId, setCpanelInvoiceId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showEditServiceModal, setShowEditServiceModal] = useState(false);
  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
  const [editServiceName, setEditServiceName] = useState('');
  const [editServiceDescription, setEditServiceDescription] = useState('');
  const [editServicePrice, setEditServicePrice] = useState('');
  const [editServiceCount, setEditServiceCount] = useState('1');
  const [editServiceDiscount, setEditServiceDiscount] = useState('0');

  // Parts state
  const [caseParts, setCaseParts] = useState<any[]>([]);

  // Discounts state
  const [servicesDiscount, setServicesDiscount] = useState('0');
  const [partsDiscount, setPartsDiscount] = useState('0');
  const [globalDiscount, setGlobalDiscount] = useState('0');
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  // VAT state
  const [includeVAT, setIncludeVAT] = useState(false);

  // Workflow status state (from cPanel)
  const [repairStatus, setRepairStatus] = useState<string | null>(null);
  const [caseStatus, setCaseStatus] = useState<string | null>(null);
  const [showWorkflowStatusModal, setShowWorkflowStatusModal] = useState(false);
  const [editingRepairStatus, setEditingRepairStatus] = useState<string | null>(null);
  const [editingCaseStatus, setEditingCaseStatus] = useState<string | null>(null);

  // Photo upload state
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [showPhotoSourceModal, setShowPhotoSourceModal] = useState(false);

  // Internal notes state
  const [internalNotes, setInternalNotes] = useState<Array<{text: string; timestamp: string; authorName: string}>>([]);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Tagging state
  const [showTagWorkModal, setShowTagWorkModal] = useState(false);
  const [taggingMode, setTaggingMode] = useState(false);
  const [selectedPartForTagging, setSelectedPartForTagging] = useState<any>(null);
  const [tagPosition, setTagPosition] = useState({ x: 0, y: 0 });
  const [showPartSelector, setShowPartSelector] = useState(false);
  const [selectedServicesForTagging, setSelectedServicesForTagging] = useState<any[]>([]);
  const [newPartName, setNewPartName] = useState('');
  const [newPartNumber, setNewPartNumber] = useState('');
  const [loadingServicesForTagging, setLoadingServicesForTagging] = useState(false);

  // Animation values
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadCaseDetails();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [id]);

  const navigation = useNavigation();

  useLayoutEffect(() => {
    // Prefer vehicle plate for the header; fall back to customer name, then short id
    if (caseData?.plate) {
      navigation.setOptions({ title: caseData.plate });
    } else if (caseData?.customerName) {
      navigation.setOptions({ title: caseData.customerName });
    } else if (id) {
      navigation.setOptions({ title: `Invoice #${id.toString().slice(0, 8).toUpperCase()}` });
    }
  }, [caseData, id, navigation]);

  const getServiceNameGeorgian = (serviceName: string): string => {
    if (!serviceName) return '';
    for (const key of Object.keys(DEFAULT_SERVICES)) {
      const service = DEFAULT_SERVICES[key as keyof typeof DEFAULT_SERVICES];
      if (service.nameEn.toLowerCase() === serviceName.toLowerCase()) {
        return service.nameKa;
      }
    }
    return serviceName;
  };

  // Workflow status helper functions
  const getWorkflowStatusColor = (status: string | null): string => {
    if (!status) return COLORS.text.secondary;
    
    // Map Georgian workflow statuses to colors
    const statusColors: { [key: string]: string } = {
      'წიანსწარი შეფასება': '#6366F1', // Blue - Initial assessment
      'მუშავდება': '#8B5CF6', // Purple - Starting work
      'იღებება': '#F59E0B', // Orange - Taking parts
      'იშლება': '#F59E0B', // Orange - Dismantling
      'აწყობა': '#F59E0B', // Orange - Assembling
      'თუნუქი': '#10B981', // Green - Painting
      'პლასტმასის აღდგენა': '#10B981', // Green - Plastic restoration
      'პოლირება': '#10B981', // Green - Polishing
      'დაშლილი და გასული': '#059669', // Dark green - Completed
    };
    
    return statusColors[status] || '#8B5CF6';
  };

  const getWorkflowStatusLabel = (status: string | null): string => {
    if (!status) return 'არ არის';
    // Return the status as-is since they're already in Georgian
    return status;
  };

  const getCaseStatusColor = (status: string | null): string => {
    if (!status) return '#94A3B8';
    switch (status) {
      case 'New': return '#3B82F6';
      case 'Processing': return '#8B5CF6';
      case 'Contacted': return '#06B6D4';
      case 'Parts ordered': return '#F59E0B';
      case 'Parts Arrived': return '#22C55E';
      case 'Scheduled': return '#6366F1';
      case 'Completed': return '#10B981';
      case 'Issue': return '#EF4444';
      default: return '#94A3B8';
    }
  };

  const getCaseStatusLabel = (status: string | null): string => {
    if (!status) return 'არ არის';
    switch (status) {
      case 'New': return 'ახალი';
      case 'Processing': return 'მუშავდება';
      case 'Contacted': return 'დარეკილი';
      case 'Parts ordered': return 'შეკვეთილია ნაწილები';
      case 'Parts Arrived': return 'ჩამოსულია ნაწილები';
      case 'Scheduled': return 'დაბარებული';
      case 'Completed': return 'დასრულებული';
      case 'Issue': return 'პრობლემა';
      default: return status;
    }
  };

  // Workflow status options
  const repairStatusOptions = [
    { value: null, label: 'არ არის' },
    { value: 'წიანსწარი შეფასება', label: 'წიანსწარი შეფასება' },
    { value: 'მუშავდება', label: 'მუშავდება' },
    { value: 'იღებება', label: 'იღებება' },
    { value: 'იშლება', label: 'იშლება' },
    { value: 'აწყობა', label: 'აწყობა' },
    { value: 'თუნუქი', label: 'თუნუქი' },
    { value: 'პლასტმასის აღდგენა', label: 'პლასტმასის აღდგენა' },
    { value: 'პოლირება', label: 'პოლირება' },
    { value: 'დაშლილი და გასული', label: 'დაშლილი და გასული' },
  ];

  const caseStatusOptions = [
    { value: null, label: 'არ არის', icon: 'minus-circle-outline', color: '#94A3B8' },
    { value: 'New', label: 'ახალი', icon: 'new-box', color: '#3B82F6' },
    { value: 'Processing', label: 'მუშავდება', icon: 'progress-wrench', color: '#8B5CF6' },
    { value: 'Contacted', label: 'დარეკილი', icon: 'phone-check', color: '#06B6D4' },
    { value: 'Parts ordered', label: 'შეკვეთილია ნაწილები', icon: 'cart-arrow-down', color: '#F59E0B' },
    { value: 'Parts Arrived', label: 'ჩამოსულია ნაწილები', icon: 'package-variant-closed-check', color: '#22C55E' },
    { value: 'Scheduled', label: 'დაბარებული', icon: 'calendar-check', color: '#6366F1' },
    { value: 'Completed', label: 'დასრულებული', icon: 'check-circle', color: '#10B981' },
    { value: 'Issue', label: 'პრობლემა', icon: 'alert-circle', color: '#EF4444' },
  ];

  const handleOpenWorkflowStatusModal = () => {
    setEditingRepairStatus(repairStatus);
    setEditingCaseStatus(caseStatus);
    setShowWorkflowStatusModal(true);
  };

  const handleSaveWorkflowStatuses = async () => {
    try {
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());

      // The status field stores the case status directly
      const updateData = {
        repair_status: editingRepairStatus,
        status: editingCaseStatus,
      };

      console.log('[Case Detail] Saving workflow statuses:', updateData, 'cpanelId:', cpanelId);

      // Update CPanel first if we have cpanel ID
      if (cpanelId) {
        const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
        const cpanelResult = await updateInvoiceToCPanel(cpanelId, updateData);
        console.log('[Case Detail] CPanel update result:', cpanelResult);
      }

      // Update Firebase
      if (!isCpanelOnly) {
        const { updateInspection } = require('../../src/services/firebase');
        await updateInspection(id as string, updateData, cpanelId || undefined);
      }

      // Update local state
      setRepairStatus(editingRepairStatus);
      setCaseStatus(editingCaseStatus);
      setCaseData((prev: any) => ({
        ...prev,
        repair_status: editingRepairStatus,
        status: editingCaseStatus,
      }));

      setShowWorkflowStatusModal(false);
      Alert.alert('✅ წარმატება', 'სტატუსი განახლდა');
    } catch (error) {
      console.error('Error saving workflow statuses:', error);
      Alert.alert('❌ შეცდომა', 'სტატუსის განახლება ვერ მოხერხდა');
    }
  };

  const handleAddInternalNote = async () => {
    if (!newNoteText.trim()) {
      Alert.alert('შეცდომა', 'გთხოვთ შეიყვანოთ შენიშვნა');
      return;
    }

    try {
      setSavingNote(true);
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());

      // Create new note object
      const newNote = {
        text: newNoteText.trim(),
        timestamp: new Date().toISOString(),
        authorName: 'მობილური აპი', // Default author name for mobile app
      };

      // Add to existing notes
      const updatedNotes = [...internalNotes, newNote];

      const updateData = {
        internalNotes: updatedNotes,
      };

      console.log('[Case Detail] Saving internal note:', updateData, 'cpanelId:', cpanelId);

      // Update CPanel first if we have cpanel ID
      if (cpanelId) {
        const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
        const cpanelResult = await updateInvoiceToCPanel(cpanelId, updateData);
        console.log('[Case Detail] CPanel update result:', cpanelResult);
      }

      // Update Firebase
      if (!isCpanelOnly) {
        const { updateInspection } = require('../../src/services/firebase');
        await updateInspection(id as string, updateData, cpanelId || undefined);
      }

      // Update local state
      setInternalNotes(updatedNotes);
      setNewNoteText('');
      setShowAddNoteModal(false);
      Alert.alert('✅ წარმატება', 'შენიშვნა დაემატა');
    } catch (error) {
      console.error('Error saving internal note:', error);
      Alert.alert('❌ შეცდომა', 'შენიშვნის შენახვა ვერ მოხერხდა');
    } finally {
      setSavingNote(false);
    }
  };

  const formatNoteDate = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${day}.${month}.${year} ${hours}:${minutes}`;
    } catch {
      return timestamp;
    }
  };

  const normalizeService = (service: any) => {
    // Try all possible name fields
    const possibleName = service.serviceNameKa || service.nameKa || service.serviceName || service.name || service.description || '';
    const englishName = service.serviceNameEn || service.serviceName || service.name || 'Unknown Service';
    
    // Use the best available name, checking Georgian names first
    let finalName = possibleName.trim();
    if (!finalName) {
      finalName = getServiceNameGeorgian(englishName) || englishName;
    }
    
    return {
      serviceName: finalName,
      serviceNameKa: finalName,
      serviceNameEn: englishName,
      description: service.description || '',
      price: service.price || service.hourly_rate || service.rate || 0,
      count: service.count || service.hours || 1,
    };
  };

  const getTotalServiceCount = (services: any[]) => {
    return services?.reduce((sum: number, s: any) => {
      const normalized = normalizeService(s);
      return sum + (normalized.count || 1);
    }, 0) || 0;
  };

  // Discount calculation functions
  const getServicesSubtotal = () => {
    return caseData?.services?.reduce((sum: number, s: any) => {
      const normalized = normalizeService(s);
      return sum + (normalized.price || 0);
    }, 0) || 0;
  };

  const getPartsSubtotal = () => {
    return caseParts?.reduce((sum: number, p: any) => 
      sum + (p.totalPrice || (p.unitPrice * (p.quantity || 1)) || 0), 0) || 0;
  };

  const getServicesTotal = () => {
    const subtotal = getServicesSubtotal();
    const discount = (parseFloat(servicesDiscount) || 0) / 100;
    return Math.max(0, subtotal - (subtotal * discount));
  };

  const getPartsTotal = () => {
    const subtotal = getPartsSubtotal();
    const discount = (parseFloat(partsDiscount) || 0) / 100;
    return Math.max(0, subtotal - (subtotal * discount));
  };

  const getSubtotalAfterDiscounts = () => {
    const subtotal = getServicesTotal() + getPartsTotal();
    const discount = (parseFloat(globalDiscount) || 0) / 100;
    return Math.max(0, subtotal - (subtotal * discount));
  };

  const getVATAmount = () => {
    if (!includeVAT) return 0;
    return getSubtotalAfterDiscounts() * 0.18; // 18% VAT
  };

  const getGrandTotal = () => {
    return getSubtotalAfterDiscounts() + getVATAmount();
  };

  const handleSaveDiscounts = async () => {
    try {
      const { updateInspection } = require('../../src/services/firebase');
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());

      const discountData = {
        services_discount_percent: parseFloat(servicesDiscount) || 0,
        parts_discount_percent: parseFloat(partsDiscount) || 0,
        global_discount_percent: parseFloat(globalDiscount) || 0,
        totalPrice: getGrandTotal(),
      };

      await updateInspection(id as string, discountData, cpanelId || undefined);

      setCaseData({ ...caseData, ...discountData });
      setShowDiscountModal(false);
      Alert.alert('✅ Success', 'Discounts updated successfully');
    } catch (error) {
      console.error('Error saving discounts:', error);
      Alert.alert('❌ Error', 'Failed to save discounts');
    }
  };

  const handleVATToggle = async () => {
    const newVATValue = !includeVAT;
    setIncludeVAT(newVATValue);

    try {
      const { updateInspection } = require('../../src/services/firebase');
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());

      // Calculate new totals with the new VAT value
      const subtotal = getSubtotalAfterDiscounts();
      const vatAmount = newVATValue ? subtotal * 0.18 : 0;
      const newTotal = subtotal + vatAmount;

      const vatData = {
        includeVAT: newVATValue,
        vatRate: newVATValue ? 0.18 : 0,
        vatAmount: vatAmount,
        subtotalBeforeVAT: subtotal,
        totalPrice: newTotal,
      };

      await updateInspection(id as string, vatData, cpanelId || undefined);
      setCaseData({ ...caseData, ...vatData });
    } catch (error) {
      console.error('Error saving VAT:', error);
      setIncludeVAT(!newVATValue); // Revert on error
      Alert.alert('❌ Error', 'Failed to update VAT');
    }
  };

  const getCPanelInvoiceId = async (): Promise<string | null> => {
    try {
      if (!id || cpanelInvoiceId) {
        return cpanelInvoiceId || null;
      }
      console.log('[Case Detail] Fetching cPanel invoice ID for Firebase ID:', id);
      const { fetchCPanelInvoiceId } = require('../../src/services/cpanelService');
      const result = await fetchCPanelInvoiceId(id as string);
      if (result) {
        console.log('[Case Detail] Retrieved cPanel invoice ID:', result);
        setCpanelInvoiceId(result);
        return result;
      }
      return null;
    } catch (error) {
      console.error('[Case Detail] Error fetching cPanel invoice ID:', error);
      return null;
    }
  };

  const handleSyncFromCPanel = async () => {
    try {
      setSyncing(true);
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());

      if (!cpanelId) {
        Alert.alert('Sync Not Available', 'This case has not been synced to cPanel yet.');
        return;
      }

      console.log('[Case Detail] Syncing from cPanel, ID:', cpanelId);
      const { fetchInvoiceFromCPanel } = require('../../src/services/cpanelService');
      const cpanelData = await fetchInvoiceFromCPanel(cpanelId);

      if (!cpanelData) {
        Alert.alert('Sync Failed', 'Could not fetch data from cPanel. The invoice may have been deleted.');
        return;
      }

      console.log('[Case Detail] cPanel data received:', cpanelData);

      const updatedData = {
        ...caseData,
        customerName: cpanelData.customerName || caseData.customerName,
        customerPhone: cpanelData.customerPhone || caseData.customerPhone,
        carMake: cpanelData.carMake || cpanelData.vehicleMake || caseData.carMake,
        carModel: cpanelData.carModel || cpanelData.vehicleModel || caseData.carModel,
        plate: cpanelData.plate || caseData.plate,
        totalPrice: cpanelData.totalPrice || caseData.totalPrice,
        status: cpanelData.status || caseData.status,
        repair_status: cpanelData.repair_status ?? caseData.repair_status ?? null,
        services: cpanelData.services || caseData.services,
        parts: cpanelData.parts || caseData.parts,
        // Sync discount fields from cPanel
        services_discount_percent: cpanelData.services_discount_percent ?? caseData.services_discount_percent ?? 0,
        parts_discount_percent: cpanelData.parts_discount_percent ?? caseData.parts_discount_percent ?? 0,
        global_discount_percent: cpanelData.global_discount_percent ?? caseData.global_discount_percent ?? 0,
      };

      const { updateInspection } = require('../../src/services/firebase');
      await updateInspection(id as string, {
        customerName: updatedData.customerName,
        customerPhone: updatedData.customerPhone,
        carMake: updatedData.carMake,
        carModel: updatedData.carModel,
        plate: updatedData.plate,
        totalPrice: updatedData.totalPrice,
        status: updatedData.status,
        repair_status: updatedData.repair_status,
        services: updatedData.services,
        parts: updatedData.parts,
        // Save discount fields to Firebase
        services_discount_percent: updatedData.services_discount_percent,
        parts_discount_percent: updatedData.parts_discount_percent,
        global_discount_percent: updatedData.global_discount_percent,
      });

      setCaseData(updatedData);
      setEditedServices(updatedData.services || []);
      setCaseParts(updatedData.parts || []);
      setEditedCustomerName(updatedData.customerName || '');
      setEditedCustomerPhone(updatedData.customerPhone || '');
      setEditedCarMake(updatedData.carMake || '');
      setEditedCarModel(updatedData.carModel || '');
      setEditedPlate(updatedData.plate || '');
      // Update discount state
      setServicesDiscount(String(updatedData.services_discount_percent || 0));
      setPartsDiscount(String(updatedData.parts_discount_percent || 0));
      setGlobalDiscount(String(updatedData.global_discount_percent || 0));
      // Update workflow status state
      setRepairStatus(updatedData.repair_status);
      setCaseStatus(updatedData.status);

      Alert.alert('✅ Sync Complete', 'Data has been synced from cPanel successfully.');
    } catch (error) {
      console.error('[Case Detail] Error syncing from cPanel:', error);
      Alert.alert('❌ Sync Error', 'Failed to sync data from cPanel.');
    } finally {
      setSyncing(false);
    }
  };

  // Silent background sync from cPanel (no alerts, used on load)
  const silentSyncFromCPanel = async (cpanelId: string, currentData: any) => {
    try {
      const { fetchInvoiceFromCPanel } = require('../../src/services/cpanelService');
      const cpanelData = await fetchInvoiceFromCPanel(cpanelId);

      if (!cpanelData) {
        console.log('[Case Detail] Silent sync: No cPanel data found');
        return;
      }

      console.log('[Case Detail] Silent sync: Comparing cPanel data with local');

      // Check if cPanel has different global discount values
      const hasGlobalDiscountChanges = 
        cpanelData.services_discount_percent !== (currentData.services_discount_percent || 0) ||
        cpanelData.parts_discount_percent !== (currentData.parts_discount_percent || 0) ||
        cpanelData.global_discount_percent !== (currentData.global_discount_percent || 0);

      // Check if cPanel has different VAT values
      const hasVATChanges =
        cpanelData.includeVAT !== (currentData.includeVAT || false) ||
        cpanelData.vatAmount !== (currentData.vatAmount || 0) ||
        cpanelData.vatRate !== (currentData.vatRate || 0) ||
        cpanelData.subtotalBeforeVAT !== (currentData.subtotalBeforeVAT || 0);

      // Check if cPanel has different workflow status values
      const hasWorkflowStatusChanges =
        cpanelData.repair_status !== (currentData.repair_status || null) ||
        cpanelData.status !== (currentData.status || 'New');

      // Check if cPanel services have different individual discounts
      const cpanelServices = cpanelData.services || [];
      const currentServices = currentData.services || [];
      let hasServiceDiscountChanges = false;
      
      if (cpanelServices.length === currentServices.length) {
        for (let i = 0; i < cpanelServices.length; i++) {
          const cpanelDiscount = cpanelServices[i].discount_percent || 0;
          const currentDiscount = currentServices[i].discount_percent || 0;
          if (cpanelDiscount !== currentDiscount) {
            hasServiceDiscountChanges = true;
            console.log(`[Case Detail] Silent sync: Service ${i} discount changed: ${currentDiscount} -> ${cpanelDiscount}`);
            break;
          }
        }
      }

      if (hasGlobalDiscountChanges || hasServiceDiscountChanges || hasVATChanges || hasWorkflowStatusChanges) {
        console.log('[Case Detail] Silent sync: Changes detected, updating Firebase');

        // Merge individual service discounts from cPanel to current services
        const updatedServices = currentServices.map((service: any, index: number) => {
          if (cpanelServices[index]) {
            return {
              ...service,
              discount_percent: cpanelServices[index].discount_percent || 0,
              discountedPrice: cpanelServices[index].discountedPrice || service.price,
            };
          }
          return service;
        });

        const { updateInspection } = require('../../src/services/firebase');
        await updateInspection(id as string, {
          services: updatedServices,
          services_discount_percent: cpanelData.services_discount_percent ?? 0,
          parts_discount_percent: cpanelData.parts_discount_percent ?? 0,
          global_discount_percent: cpanelData.global_discount_percent ?? 0,
          includeVAT: cpanelData.includeVAT ?? false,
          vatAmount: cpanelData.vatAmount ?? 0,
          vatRate: cpanelData.vatRate ?? 0,
          subtotalBeforeVAT: cpanelData.subtotalBeforeVAT ?? 0,
          totalPrice: cpanelData.totalPrice || currentData.totalPrice,
          // Workflow statuses
          repair_status: cpanelData.repair_status ?? null,
          status: cpanelData.status ?? currentData.status,
        });

        // Update local state
        setServicesDiscount(String(cpanelData.services_discount_percent || 0));
        setPartsDiscount(String(cpanelData.parts_discount_percent || 0));
        setGlobalDiscount(String(cpanelData.global_discount_percent || 0));
        setIncludeVAT(cpanelData.includeVAT || false);
        setRepairStatus(cpanelData.repair_status ?? null);
        setCaseStatus(cpanelData.status ?? null);
        // Sync internal notes from cPanel
        if (cpanelData.internalNotes && Array.isArray(cpanelData.internalNotes)) {
          setInternalNotes(cpanelData.internalNotes);
        }
        setCaseData((prev: any) => ({
          ...prev,
          services: updatedServices,
          services_discount_percent: cpanelData.services_discount_percent ?? 0,
          parts_discount_percent: cpanelData.parts_discount_percent ?? 0,
          global_discount_percent: cpanelData.global_discount_percent ?? 0,
          includeVAT: cpanelData.includeVAT ?? false,
          vatAmount: cpanelData.vatAmount ?? 0,
          vatRate: cpanelData.vatRate ?? 0,
          subtotalBeforeVAT: cpanelData.subtotalBeforeVAT ?? 0,
          totalPrice: cpanelData.totalPrice || prev.totalPrice,
          repair_status: cpanelData.repair_status ?? null,
          status: cpanelData.status ?? prev.status,
        }));
        setEditedServices(updatedServices);

        console.log('[Case Detail] Silent sync: Data updated from cPanel (including workflow statuses)');
      } else {
        console.log('[Case Detail] Silent sync: No changes detected');
      }
    } catch (error) {
      console.error('[Case Detail] Silent sync error (non-blocking):', error);
      // Don't show error to user, this is a background sync
    }
  };

  const loadCaseDetails = async () => {
    try {
      setLoading(true);

      // If this is a CPanel-only case, fetch directly from CPanel
      if (isCpanelOnly) {
        console.log('[Case Detail] Loading CPanel-only case:', id);
        const cpanelData = await fetchInvoiceFromCPanel(id as string);

        if (cpanelData) {
          const data = {
            id: cpanelData.cpanelId?.toString() || id,
            customerName: cpanelData.customerName || '',
            customerPhone: cpanelData.customerPhone || '',
            carMake: cpanelData.carMake || cpanelData.vehicleMake || '',
            carModel: cpanelData.carModel || cpanelData.vehicleModel || '',
            plate: cpanelData.plate || '',
            totalPrice: cpanelData.totalPrice || 0,
            repair_status: cpanelData.repair_status || null,
            status: cpanelData.status || 'New',
            services: cpanelData.services || [],
            parts: cpanelData.parts || [],
            photos: cpanelData.photos || [],
            createdAt: cpanelData.createdAt,
            updatedAt: cpanelData.updatedAt,
            services_discount_percent: cpanelData.services_discount_percent || 0,
            parts_discount_percent: cpanelData.parts_discount_percent || 0,
            global_discount_percent: cpanelData.global_discount_percent || 0,
            includeVAT: cpanelData.includeVAT || false,
            vatAmount: cpanelData.vatAmount || 0,
            vatRate: cpanelData.vatRate || 0,
            subtotalBeforeVAT: cpanelData.subtotalBeforeVAT || 0,
            isCpanelOnly: true,
          };

          setCaseData(data);
          setEditedServices(data.services || []);
          setCaseParts(data.parts || []);
          setEditedCustomerName(data.customerName || '');
          setEditedCustomerPhone(data.customerPhone || '');
          setEditedCarMake(data.carMake || '');
          setEditedCarModel(data.carModel || '');
          setEditedPlate(data.plate || '');
          setServicesDiscount(String(data.services_discount_percent || 0));
          setPartsDiscount(String(data.parts_discount_percent || 0));
          setGlobalDiscount(String(data.global_discount_percent || 0));
          setIncludeVAT(data.includeVAT || false);
          setRepairStatus(data.repair_status);
          setCaseStatus(data.status || null);
          setCpanelInvoiceId(id as string);
          // Load internal notes
          setInternalNotes(cpanelData.internalNotes || []);
        } else {
          Alert.alert('❌ Error', 'CPanel case not found');
          router.back();
        }
        return;
      }

      // Firebase case loading
      const { db } = require('../../src/services/firebase');
      const { doc, getDoc } = require('firebase/firestore');

      const docRef = doc(db, 'inspections', id as string);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setCaseData(data);
        setEditedServices(data.services || []);
        // inventoryParts contains parts with prices, parts contains damage tagging data
        setCaseParts(data.inventoryParts || []);
        setEditedCustomerName(data.customerName || '');
        setEditedCustomerPhone(data.customerPhone || '');
        setEditedCarMake(data.carMake || '');
        setEditedCarModel(data.carModel || '');
        setEditedCarMakeId(data.carMakeId || '');
        setEditedCarModelId(data.carModelId || '');
        setEditedPlate(data.plate || '');
        // Load discounts
        setServicesDiscount(String(data.services_discount_percent || 0));
        setPartsDiscount(String(data.parts_discount_percent || 0));
        setGlobalDiscount(String(data.global_discount_percent || 0));
        // Load VAT
        setIncludeVAT(data.includeVAT || false);
        // Load workflow statuses
        setRepairStatus(data.repair_status || null);
        setCaseStatus(data.status || null);
        // Load internal notes
        setInternalNotes(data.internalNotes || []);
        if (data.cpanelInvoiceId) {
          setCpanelInvoiceId(data.cpanelInvoiceId);
          console.log('[Case Detail] cPanel invoice ID:', data.cpanelInvoiceId);
          // Background sync from cPanel to get latest data (non-blocking)
          silentSyncFromCPanel(data.cpanelInvoiceId, data);
        }
      } else {
        Alert.alert('❌ Error', 'Case not found');
        router.back();
      }
    } catch (error) {
      console.error('Error loading case:', error);
      Alert.alert('❌ Error', 'Failed to load case details');
    } finally {
      setLoading(false);
    }
  };

  const handleSharePublicLink = async () => {
    if (!caseData) return;

    // Get the cPanel invoice ID
    const invoiceId = cpanelInvoiceId || (await getCPanelInvoiceId());

    if (!invoiceId) {
      Alert.alert('❌ Error', 'Invoice has not been synced to portal yet. Please try syncing first.');
      return;
    }

    try {
      // Fetch full invoice data to get the slug
      const invoiceData = await fetchInvoiceFromCPanel(invoiceId);
      const slug = invoiceData?.slug;

      if (!slug) {
        Alert.alert('❌ Error', 'Slug not found for this invoice.');
        return;
      }

      const publicUrl = `https://portal.otoexpress.ge/public_invoice.php?slug=${slug}`;

      const result = await Share.share({
        message: `📋 Invoice for ${caseData.customerName || 'Customer'}\n🚗 ${caseData.plate || caseData.carModel || 'Vehicle'}\n💰 Total: ${formatCurrencyGEL(caseData.totalPrice)}\n\n🔗 View invoice: ${publicUrl}`,
        url: publicUrl, // iOS only
        title: `Invoice #${id.toString().slice(0, 8).toUpperCase()}`,
      });

      if (result.action === Share.sharedAction) {
        console.log('[Case Detail] Invoice link shared successfully');
      }
    } catch (error: any) {
      console.error('Error sharing link:', error);
      Alert.alert('❌ Error', 'Failed to share link');
    }
  };

  const handleWhatsAppShare = async () => {
    if (!caseData) return;

    const message = `🚗 Invoice #${id.slice(0, 8)}\n\n` +
      `📋 Customer: ${caseData.customerName || 'N/A'}\n` +
      `🚗 Plate: ${caseData.plate || caseData.carModel || 'N/A'}\n` +
      `💰 Total: ${formatCurrencyGEL(caseData.totalPrice)}\n\n` +
      `Services:\n` +
      (caseData.services || []).map((s: any) => {
        const normalized = normalizeService(s);
        return `• ${getServiceNameGeorgian(normalized.serviceName)} ${normalized.count > 1 ? `x${normalized.count}` : ''} - ${formatCurrencyGEL(normalized.price)}`;
      }).join('\n');

    const cleanPhone = caseData.customerPhone.replace(/\D/g, '');
    const whatsappPhone = cleanPhone.startsWith('995') ? cleanPhone : `995${cleanPhone}`;
    const whatsappUrl = `whatsapp://send?phone=${whatsappPhone}&text=${encodeURIComponent(message)}`;

    const canOpen = await Linking.canOpenURL(whatsappUrl);
    if (canOpen) {
      await Linking.openURL(whatsappUrl);
    } else {
      Alert.alert('❌ WhatsApp Not Available', 'Please install WhatsApp to send invoices');
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const { updateInspection } = require('../../src/services/firebase');
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
      console.log('[Case Detail] Updating status with cPanel ID:', cpanelId);
      await updateInspection(id as string, { status: newStatus }, cpanelId || undefined);
      setCaseData({ ...caseData, status: newStatus });
      Alert.alert('✅ Success', `Status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('❌ Error', 'Failed to update status');
    }
  };

  const handleEditToggle = () => {
    if (editMode) {
      setEditedServices(caseData.services || []);
    }
    setEditMode(!editMode);
  };

  const handleSaveChanges = async () => {
    try {
      const { updateInspection } = require('../../src/services/firebase');
      const newTotal = editedServices.reduce((sum, s) => sum + (normalizeService(s).price || s.price || 0), 0);
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
      console.log('[Case Detail] Saving with cPanel ID:', cpanelId);

      await updateInspection(id as string, {
        services: editedServices,
        totalPrice: newTotal
      }, cpanelId || undefined);

      setCaseData({ ...caseData, services: editedServices, totalPrice: newTotal });
      setEditMode(false);
      Alert.alert('✅ Success', 'Invoice updated successfully');
    } catch (error) {
      console.error('Error updating invoice:', error);
      Alert.alert('❌ Error', 'Failed to update invoice');
    }
  };

  const handleServicePriceChange = (index: number, newPrice: string) => {
    const updated = [...editedServices];
    const price = parseFloat(newPrice) || 0;
    updated[index] = { ...updated[index], price };
    setEditedServices(updated);
  };

  const handleServiceCountChange = (index: number, newCount: string) => {
    const updated = [...editedServices];
    const oldCount = normalizeService(updated[index]).count || 1;
    const newCountNum = parseInt(newCount) || 1;

    // Calculate price per unit
    const currentPrice = updated[index].price || 0;
    const pricePerUnit = currentPrice / oldCount;

    // Adjust price based on new quantity
    const newPrice = pricePerUnit * newCountNum;

    updated[index] = {
      ...updated[index],
      count: newCountNum,
      price: Math.round(newPrice * 100) / 100 // Round to 2 decimal places
    };

    setEditedServices(updated);

    console.log(`[Case Detail] Quantity changed: ${oldCount} → ${newCountNum}, Price adjusted: ${currentPrice} → ${newPrice.toFixed(2)}`);
  };

  const handleDeleteService = (index: number) => {
    Alert.alert(
      '🗑️ Delete Service',
      'Are you sure you want to remove this service?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updated = editedServices.filter((_, i) => i !== index);
            setEditedServices(updated);
          }
        }
      ]
    );
  };

  const handleOpenEditService = (index: number) => {
    const service = caseData.services[index];
    const normalized = normalizeService(service);

    setEditingServiceIndex(index);
    setEditServiceName(normalized.serviceName);
    setEditServiceDescription(normalized.description || '');
    setEditServicePrice(normalized.price.toString());
    setEditServiceCount(normalized.count.toString());
    setEditServiceDiscount((service.discount_percent || 0).toString());
    setShowEditServiceModal(true);
  };

  const handleEditServiceCountChange = (newCount: string) => {
    const oldCount = parseInt(editServiceCount) || 1;
    const newCountNum = parseInt(newCount) || 1;

    // Calculate price per unit based on current total price
    const currentTotalPrice = parseFloat(editServicePrice) || 0;
    const pricePerUnit = currentTotalPrice / oldCount;

    // Adjust total price based on new quantity
    const newTotalPrice = pricePerUnit * newCountNum;
    const roundedPrice = Math.round(newTotalPrice * 100) / 100;

    setEditServiceCount(newCount);
    setEditServicePrice(roundedPrice.toString());

    console.log(`[Edit Modal] Quantity changed: ${oldCount} → ${newCountNum}, Price adjusted: ${currentTotalPrice} → ${roundedPrice.toFixed(2)}`);
  };

  const handleSaveEditedService = async () => {
    if (!editServiceName.trim() || !editServicePrice.trim()) {
      Alert.alert('⚠️ Validation Error', 'Service name and price are required');
      return;
    }

    if (editingServiceIndex === null) return;

    try {
      const { updateInspection } = require('../../src/services/firebase');
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());

      const serviceDiscountPercent = parseFloat(editServiceDiscount) || 0;
      const serviceBasePrice = parseFloat(editServicePrice) || 0;
      const serviceDiscountedPrice = serviceBasePrice * (1 - serviceDiscountPercent / 100);

      // Get the Georgian name - editServiceName may already be Georgian
      const georgianName = editServiceName.trim();
      
      const updatedServices = [...caseData.services];
      updatedServices[editingServiceIndex] = {
        ...updatedServices[editingServiceIndex],
        serviceName: georgianName,
        serviceNameKa: georgianName,
        name: georgianName, // For PHP compatibility
        nameKa: georgianName, // Backup field
        description: editServiceDescription,
        price: serviceBasePrice,
        discountedPrice: serviceDiscountedPrice,
        discount_percent: serviceDiscountPercent,
        count: parseInt(editServiceCount) || 1,
      };
      
      console.log('[Case Detail] Saving service - FULL SERVICE OBJECT:', JSON.stringify(updatedServices[editingServiceIndex], null, 2));
      console.log('[Case Detail] ALL SERVICES TO SAVE:', JSON.stringify(updatedServices, null, 2));

      // Calculate new total with individual service discounts and global discounts
      const servicesSubtotal = updatedServices.reduce((sum, s) => {
        const sPrice = normalizeService(s).price || s.price || 0;
        const sDiscount = s.discount_percent || 0;
        return sum + (sPrice * (1 - sDiscount / 100));
      }, 0);
      const partsSubtotal = caseParts?.reduce((sum: number, p: any) => {
        const pPrice = p.totalPrice || (p.unitPrice * (p.quantity || 1)) || 0;
        const pDiscount = p.discount_percent || 0;
        return sum + (pPrice * (1 - pDiscount / 100));
      }, 0) || 0;
      
      // Apply global discounts on top of individual discounts
      const servicesDiscountAmount = servicesSubtotal * ((parseFloat(servicesDiscount) || 0) / 100);
      const partsDiscountAmount = partsSubtotal * ((parseFloat(partsDiscount) || 0) / 100);
      const subtotalAfterItemDiscounts = (servicesSubtotal - servicesDiscountAmount) + (partsSubtotal - partsDiscountAmount);
      const globalDiscountAmount = subtotalAfterItemDiscounts * ((parseFloat(globalDiscount) || 0) / 100);
      const newTotal = Math.max(0, subtotalAfterItemDiscounts - globalDiscountAmount);

      await updateInspection(id as string, {
        services: updatedServices,
        totalPrice: newTotal,
      }, cpanelId || undefined);

      setCaseData({ 
        ...caseData, 
        services: updatedServices, 
        totalPrice: newTotal,
      });
      setShowEditServiceModal(false);
      setEditingServiceIndex(null);
      setEditServiceName('');
      setEditServiceDescription('');
      setEditServicePrice('');
      setEditServiceCount('1');
      setEditServiceDiscount('0');
      Alert.alert('✅ Success', 'Service updated successfully');
    } catch (error) {
      console.error('Error updating service:', error);
      Alert.alert('❌ Error', 'Failed to update service');
    }
  };

  const handleImagePress = (photo: any, index: number) => {
    setSelectedImage(photo);
    setSelectedImageIndex(index);
    // reset tagging state so previous incomplete flows don't block new tagging
    setTaggingMode(false);
    setShowTagWorkModal(false);
    setShowPartSelector(false);
    setSelectedPartForTagging(null);
    setSelectedServicesForTagging([]);
    setNewPartName('');
    setNewPartNumber('');
    setTagPosition({ x: 0, y: 0 });
    setShowImageModal(true);
  };

  const handleCustomerEditToggle = () => {
    if (editCustomerMode) {
      setEditedCustomerName(caseData.customerName || '');
      setEditedCustomerPhone(caseData.customerPhone || '');
      setEditedCarModel(caseData.carModel || '');
      setEditedPlate(caseData.plate || '');
    }
    setEditCustomerMode(!editCustomerMode);
  };

  const loadAvailableServices = async () => {
    try {
      setLoadingServices(true);
      const services = await ServiceService.getAllServices();
      setAvailableServices(services);
    } catch (error) {
      console.error('Error loading services:', error);
      Alert.alert('❌ Error', 'Failed to load services from database');
      setAvailableServices([]);
    } finally {
      setLoadingServices(false);
    }
  };

  const handleOpenAddServiceModal = () => {
    setShowAddServiceModal(true);
    if (availableServices.length === 0) {
      loadAvailableServices();
    }
  };

  const handleSelectServiceFromDB = (service: any) => {
    setSelectedService(service);
    setNewServiceName(service.nameKa || service.nameEn); // Use Georgian as default
    setNewServicePrice(service.basePrice.toString());
  };

  const handleSaveCustomerInfo = async () => {
    if (!editedCustomerName.trim() || !editedCustomerPhone.trim()) {
      Alert.alert('⚠️ Validation Error', 'Customer name and phone are required');
      return;
    }

    try {
      const { updateInspection } = require('../../src/services/firebase');
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
      console.log('[Case Detail] Saving customer info with cPanel ID:', cpanelId);

      await updateInspection(id as string, {
        customerName: editedCustomerName,
        customerPhone: editedCustomerPhone,
        carMake: editedCarMake,
        carModel: editedCarModel,
        carMakeId: editedCarMakeId,
        carModelId: editedCarModelId,
        plate: editedPlate
      }, cpanelId || undefined);

      setCaseData({
        ...caseData,
        customerName: editedCustomerName,
        customerPhone: editedCustomerPhone,
        carMake: editedCarMake,
        carModel: editedCarModel,
        carMakeId: editedCarMakeId,
        carModelId: editedCarModelId,
        plate: editedPlate
      });
      setEditCustomerMode(false);
      Alert.alert('✅ Success', 'Customer information updated successfully');
    } catch (error) {
      console.error('Error updating customer info:', error);
      Alert.alert('❌ Error', 'Failed to update customer information');
    }
  };

  const handleAddService = async () => {
    if (!newServiceName.trim() || !newServicePrice.trim()) {
      Alert.alert('⚠️ Validation Error', 'Service name and price are required');
      return;
    }

    try {
      const { updateInspection } = require('../../src/services/firebase');
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
      console.log('[Case Detail] Adding service with cPanel ID:', cpanelId);

      // Use Georgian name as primary, English as backup
      const georgianName = selectedService?.nameKa || getServiceNameGeorgian(newServiceName) || newServiceName;
      
      const newService = {
        serviceName: georgianName, // Store Georgian as primary name
        serviceNameKa: georgianName,
        name: georgianName, // For PHP compatibility
        nameKa: georgianName, // Backup field
        serviceNameEn: selectedService?.nameEn || newServiceName, // Store English as backup
        price: parseFloat(newServicePrice) || 0,
        count: parseInt(newServiceCount) || 1,
        discount_percent: 0, // Default no discount
      };
      
      console.log('[Case Detail] New service object:', newService);

      // Check if service already exists and combine if it does
      // Use editedServices if in edit mode, otherwise use caseData.services
      const currentServices = editMode ? editedServices : (caseData.services || []);
      const existingServices = [...currentServices];

      // Find existing service by checking both English and Georgian names
      console.log('[Case Detail] Checking for duplicate service:', {
        newService: { en: newService.serviceNameEn, ka: newService.serviceNameKa },
        existingCount: existingServices.length
      });

      const existingServiceIndex = existingServices.findIndex(s => {
        const normalized = normalizeService(s);
        const existingNameEn = normalized.serviceName.toLowerCase();
        const existingNameKa = (s.serviceNameKa || '').toLowerCase();
        const newNameEn = newService.serviceName.toLowerCase();
        const newNameKa = (newService.serviceNameKa || '').toLowerCase();

        const matches = existingNameEn === newNameEn ||
                       (existingNameKa && existingNameKa === newNameKa) ||
                       (existingNameEn === newNameKa) ||
                       (existingNameKa === newNameEn);

        if (matches) {
          console.log('[Case Detail] Found matching service:', {
            existing: { en: existingNameEn, ka: existingNameKa },
            new: { en: newNameEn, ka: newNameKa }
          });
        }

        return matches;
      });

      let updatedServices;
      if (existingServiceIndex !== -1) {
        // Service exists - combine quantities and add prices
        const existingService = existingServices[existingServiceIndex];
        const normalized = normalizeService(existingService);

        updatedServices = [...existingServices];
        updatedServices[existingServiceIndex] = {
          ...existingService,
          count: normalized.count + newService.count,
          price: normalized.price + newService.price,
        };

        console.log(`[Case Detail] ✅ Combined duplicate service: ${newService.serviceName} (Count: ${normalized.count} + ${newService.count} = ${normalized.count + newService.count}, Price: ${normalized.price} + ${newService.price} = ${normalized.price + newService.price})`);
      } else {
        // New service - add to list
        updatedServices = [...existingServices, newService];
        console.log('[Case Detail] ➕ Added new service:', newService.serviceName);
      }

      const newTotal = updatedServices.reduce((sum, s) => sum + (normalizeService(s).price || s.price || 0), 0);

      await updateInspection(id as string, {
        services: updatedServices,
        totalPrice: newTotal,
      }, cpanelId || undefined);

      setCaseData({ ...caseData, services: updatedServices, totalPrice: newTotal });
      setEditedServices(updatedServices);
      setShowAddServiceModal(false);
      setNewServiceName('');
      setNewServicePrice('');
      setNewServiceCount('1');
      setSelectedService(null);
      Alert.alert('✅ Success', 'Service added successfully');
    } catch (error) {
      console.error('Error adding service:', error);
      Alert.alert('❌ Error', 'Failed to add service');
    }
  };

  const handleAddPhotos = async () => {
    setShowPhotoSourceModal(true);
  };

  const handleTakePhoto = async () => {
    setShowPhotoSourceModal(false);

    // 1. Request camera permissions
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraStatus !== 'granted') {
      Alert.alert('Permission required', 'Sorry, we need camera permissions to take photos!');
      return;
    }

    // 2. Launch camera
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      try {
        setIsUploadingPhotos(true);
        const { uploadMultipleImages, updateInspection } = require('../../src/services/firebase');

        // 3. Upload the photo to Firebase Storage
        const newImages = result.assets.map(asset => ({ uri: asset.uri, label: 'Camera Photo' }));
        const uploadedPhotos = await uploadMultipleImages(newImages, id as string);

        // 4. Combine with existing photos
        const existingPhotos = caseData.photos || [];
        const updatedPhotos = [...existingPhotos, ...uploadedPhotos];

        // 5. Update inspection document in Firestore
        const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
        await updateInspection(id as string, { photos: updatedPhotos }, cpanelId || undefined);

        // 6. Update local state
        setCaseData({ ...caseData, photos: updatedPhotos });

        Alert.alert('Success', 'Photo taken and added successfully!');
      } catch (error) {
        console.error('Error taking photo:', error);
        Alert.alert('Error', 'Failed to take photo. Please try again.');
      } finally {
        setIsUploadingPhotos(false);
      }
    }
  };

  const handleSelectFromGallery = async () => {
    setShowPhotoSourceModal(false);

    // 1. Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    // 2. Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets) {
      try {
        setIsUploadingPhotos(true);
        const { uploadMultipleImages, updateInspection } = require('../../src/services/firebase');

        // 3. Upload new images to Firebase Storage
        const newImages = result.assets.map(asset => ({ uri: asset.uri, label: 'Gallery Photo' }));
        const uploadedPhotos = await uploadMultipleImages(newImages, id as string);

        // 4. Combine with existing photos
        const existingPhotos = caseData.photos || [];
        const updatedPhotos = [...existingPhotos, ...uploadedPhotos];

        // 5. Update inspection document in Firestore
        const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
        await updateInspection(id as string, { photos: updatedPhotos }, cpanelId || undefined);

        // 6. Update local state
        setCaseData({ ...caseData, photos: updatedPhotos });

        Alert.alert('Success', 'Photos added successfully!');
      } catch (error) {
        console.error('Error adding photos:', error);
        Alert.alert('Error', 'Failed to add photos. Please try again.');
      } finally {
        setIsUploadingPhotos(false);
      }
    }
  };

  const handleRemovePhoto = async (photoIndex: number) => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { updateInspection } = require('../../src/services/firebase');

              // Remove the photo from the array
              const updatedPhotos = caseData.photos.filter((_: any, index: number) => index !== photoIndex);

              // Update inspection document in Firestore
              const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
              await updateInspection(id as string, { photos: updatedPhotos }, cpanelId || undefined);

              // Update local state
              setCaseData({ ...caseData, photos: updatedPhotos });

              // Close image modal if the removed photo was being viewed
              if (selectedImageIndex === photoIndex) {
                setShowImageModal(false);
                setSelectedImage(null);
                setSelectedImageIndex(-1);
              }

              Alert.alert('Success', 'Photo removed successfully!');
            } catch (error) {
              console.error('Error removing photo:', error);
              Alert.alert('Error', 'Failed to remove photo. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleSaveTag = async () => {
    // Validate tag position (0 is valid)
    if (tagPosition.x == null || tagPosition.y == null || Number.isNaN(tagPosition.x) || Number.isNaN(tagPosition.y)) {
      Alert.alert('Error', 'Please tap on the photo to choose a location');
      return;
    }

    if (selectedImageIndex == null || selectedImageIndex < 0) {
      Alert.alert('Error', 'No photo selected');
      return;
    }

    // If user didn't pick an existing part, require a new part name
    const isCreatingNewPart = !selectedPartForTagging || (newPartName && newPartName.trim().length > 0);
    if (isCreatingNewPart && (!newPartName || newPartName.trim().length === 0)) {
      Alert.alert('Error', 'Please enter a part name');
      return;
    }

    // Require at least one service selected for the tag
    if (!selectedServicesForTagging || selectedServicesForTagging.length === 0) {
      Alert.alert('Error', 'Please select at least one service for this tag');
      return;
    }

    try {
      const { updateInspection } = require('../../src/services/firebase');

      // Build services payload from selected services
      const servicesPayload = selectedServicesForTagging.map((s: any) => ({ name: s.name || s.serviceName || s.title, price: s.price || s.basePrice || 0 }));

      // Create the damage/tag object
      const newDamage = {
        photoIndex: selectedImageIndex,
        xPercent: tagPosition.x,
        yPercent: tagPosition.y,
        services: servicesPayload,
      };

      // Prepare updated parts array
      let updatedParts = Array.isArray(caseData.parts) ? [...caseData.parts] : [];

      if (!isCreatingNewPart) {
        // Attach to existing selected part
        const existingPartIndex = updatedParts.findIndex((part: any) =>
          part.id === selectedPartForTagging.id ||
          part.nameKa === selectedPartForTagging.nameKa ||
          part.name === selectedPartForTagging.name
        );

        if (existingPartIndex !== -1) {
          const existingPart = updatedParts[existingPartIndex];
          const updatedPart = {
            ...existingPart,
            damages: [...(existingPart.damages || []), newDamage],
          };
          updatedParts[existingPartIndex] = updatedPart;
        } else {
          // selectedPartForTagging wasn't found by id — add as new with supplied services
          const fallbackPart = {
            ...(selectedPartForTagging || {}),
            id: selectedPartForTagging?.id || `part-${Date.now()}`,
            damages: [newDamage],
          };
          updatedParts.push(fallbackPart);
        }
      } else {
        // Create a new part from newPartName + selected services
        const newPart = {
          id: `part-${Date.now()}`,
          name: newPartName.trim(),
          nameKa: newPartName.trim(),
          partNumber: newPartNumber?.trim() || undefined,
          unitPrice: servicesPayload.reduce((s: number, it: any) => s + (it.price || 0), 0),
          damages: [newDamage],
        } as any;

        updatedParts = [...updatedParts, newPart];
      }

      // Persist
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
      await updateInspection(id as string, { parts: updatedParts }, cpanelId || undefined);

      // Update local state
      setCaseData({ ...caseData, parts: updatedParts });
      setCaseParts(updatedParts);

      // Reset tagging UI state
      setShowTagWorkModal(false);
      setShowPartSelector(false);
      setTaggingMode(false);
      setSelectedPartForTagging(null);
      setSelectedServicesForTagging([]);
      setNewPartName('');
      setNewPartNumber('');
      setTagPosition({ x: 0, y: 0 });

      Alert.alert('Success', 'Work tagged successfully!');
    } catch (error) {
      console.error('Error saving tag:', error);
      Alert.alert('Error', 'Failed to tag work. Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>იტვირთება...</Text>
      </View>
    );
  }

  if (!caseData) {
    return null;
  }

  const totalServices = getTotalServiceCount(caseData.services || []);
  const currentTotal = editMode
    ? editedServices.reduce((sum, s) => sum + (s.price || 0), 0)
    : caseData.totalPrice;

  return (
    <View style={styles.container}>
      {/* Modern Gradient Header */}
      <Surface style={styles.header} elevation={4}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <View style={styles.backButtonCircle}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
            </View>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {caseData.plate || caseData.carModel || 'No Plate'}
            </Text>
            <Text style={styles.headerSubtitle}>#{id.toString().slice(0, 8).toUpperCase()}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleSharePublicLink}
              style={styles.shareButton}
            >
              <MaterialCommunityIcons
                name="share-variant"
                size={20}
                color={COLORS.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSyncFromCPanel}
              disabled={syncing}
              style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
            >
              <MaterialCommunityIcons
                name="sync"
                size={20}
                color={syncing ? COLORS.text.disabled : COLORS.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </Surface>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Hero Status Card with Gradient */}
          <Card style={styles.heroCard}>
            <View style={styles.heroGradient}>
              <View style={styles.heroContent}>
                <View style={styles.statusSection}>
                  <View style={styles.statusBadgeContainer}>
                    <MaterialCommunityIcons name="file-document-outline" size={18} color="#fff" />
                    <Text style={styles.statusBadgeText}>{caseData.status}</Text>
                  </View>
                  <Text style={styles.heroPhone}>{caseData.customerPhone}</Text>
                </View>
                <View style={styles.totalSection}>
                  <Text style={styles.totalLabel}>ჯამური თანხა</Text>
                  <Text style={styles.totalValue}>{formatCurrencyGEL(currentTotal)}</Text>
                  <View style={styles.priceDot} />
                </View>
              </View>
            </View>
          </Card>

          {/* Workflow Status Card */}
          <Card style={styles.modernCard}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#8B5CF6' + '15' }]}>
                    <MaterialCommunityIcons name="clipboard-flow" size={20} color="#8B5CF6" />
                  </View>
                  <Text style={styles.cardTitle}>სამუშაო სტატუსი</Text>
                </View>
                <TouchableOpacity
                  onPress={handleOpenWorkflowStatusModal}
                  style={styles.editIconButton}
                >
                  <MaterialCommunityIcons
                    name="pencil-circle"
                    size={28}
                    color="#8B5CF6"
                  />
                </TouchableOpacity>
              </View>

                <View style={styles.workflowStatusContainer}>
                  {/* Repair Status */}
                  <View style={styles.workflowStatusRow}>
                    <View style={styles.workflowStatusLabel}>
                      <MaterialCommunityIcons name="wrench" size={16} color={COLORS.text.secondary} />
                      <Text style={styles.workflowLabelText}>რემონტის სტატუსი</Text>
                    </View>
                    <View style={[
                      styles.workflowStatusBadge,
                      { backgroundColor: getWorkflowStatusColor(repairStatus) + '15' }
                    ]}>
                      <Text style={[
                        styles.workflowStatusText,
                        { color: getWorkflowStatusColor(repairStatus) }
                      ]}>
                        {getWorkflowStatusLabel(repairStatus)}
                      </Text>
                    </View>
                  </View>

                  {/* User Response */}
                  <View style={styles.workflowStatusRow}>
                    <View style={styles.workflowStatusLabel}>
                      <MaterialCommunityIcons name="briefcase-check" size={16} color={COLORS.text.secondary} />
                      <Text style={styles.workflowLabelText}>საქმის სტატუსი</Text>
                    </View>
                    <View style={[
                      styles.workflowStatusBadge,
                      { backgroundColor: getCaseStatusColor(caseStatus) + '15' }
                    ]}>
                      <Text style={[
                        styles.workflowStatusText,
                        { color: getCaseStatusColor(caseStatus) }
                      ]}>
                        {getCaseStatusLabel(caseStatus)}
                      </Text>
                    </View>
                  </View>
                </View>
              </Card.Content>
            </Card>

          {/* Customer Info Card - Enhanced */}
          <Card style={styles.modernCard}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={styles.iconCircle}>
                    <MaterialCommunityIcons name="account" size={20} color={COLORS.primary} />
                  </View>
                  <Text style={styles.cardTitle}>მომხმარებელი</Text>
                </View>
                <TouchableOpacity
                  onPress={handleCustomerEditToggle}
                  style={styles.editIconButton}
                >
                  <MaterialCommunityIcons
                    name={editCustomerMode ? "close-circle" : "pencil-circle"}
                    size={28}
                    color={editCustomerMode ? COLORS.error : COLORS.primary}
                  />
                </TouchableOpacity>
              </View>

              {editCustomerMode ? (
                <View style={styles.editForm}>
                  <TextInput
                    label="სახელი *"
                    value={editedCustomerName}
                    onChangeText={setEditedCustomerName}
                    mode="outlined"
                    style={styles.modernInput}
                    outlineStyle={styles.inputOutline}
                    left={<TextInput.Icon icon="account" />}
                  />
                  <TextInput
                    label="ტელეფონი *"
                    value={editedCustomerPhone}
                    onChangeText={setEditedCustomerPhone}
                    mode="outlined"
                    keyboardType="phone-pad"
                    style={styles.modernInput}
                    outlineStyle={styles.inputOutline}
                    left={<TextInput.Icon icon="phone" />}
                  />
                  <TextInput
                    label="სახელმწიფო ნომერი *"
                    value={editedPlate}
                    onChangeText={setEditedPlate}
                    mode="outlined"
                    style={styles.modernInput}
                    outlineStyle={styles.inputOutline}
                    left={<TextInput.Icon icon="car" />}
                    placeholder="AA-123-BB"
                  />
                  
                  {/* Car Make & Model */}
                  <Text style={styles.sectionSubtitle}>მანქანის მარკა და მოდელი</Text>
                  <CarSelector
                    value={editedCarMakeId && editedCarModelId ? {
                      makeId: editedCarMakeId,
                      makeName: editedCarMake,
                      modelId: editedCarModelId,
                      modelName: editedCarModel,
                    } : null}
                    onChange={(car: SelectedCar | null) => {
                      if (car) {
                        setEditedCarMake(car.makeName);
                        setEditedCarModel(car.modelName);
                        setEditedCarMakeId(car.makeId);
                        setEditedCarModelId(car.modelId);
                      } else {
                        setEditedCarMake('');
                        setEditedCarModel('');
                        setEditedCarMakeId('');
                        setEditedCarModelId('');
                      }
                    }}
                    placeholder="აირჩიეთ მარკა და მოდელი"
                  />
                  
                  <View style={styles.modernEditActions}>
                    <Button
                      mode="outlined"
                      onPress={handleCustomerEditToggle}
                      style={styles.modernButton}
                      textColor={COLORS.text.secondary}
                    >
                      გაუქმება
                    </Button>
                    <Button
                      mode="contained"
                      onPress={handleSaveCustomerInfo}
                      style={[styles.modernButton, styles.primaryButton]}
                      buttonColor={COLORS.primary}
                    >
                      შენახვა
                    </Button>
                  </View>
                </View>
              ) : (
                <View style={styles.infoList}>
                  <TouchableOpacity
                    style={styles.modernInfoRow}
                    onPress={() => Linking.openURL(`tel:${caseData.customerPhone}`)}
                  >
                    <View style={styles.infoIconContainer}>
                      <MaterialCommunityIcons name="account-outline" size={22} color={COLORS.primary} />
                    </View>
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>სახელი</Text>
                      <Text style={styles.infoValue}>{caseData.customerName || 'N/A'}</Text>
                    </View>
                  </TouchableOpacity>

                  <Divider style={styles.modernDivider} />

                  <TouchableOpacity
                    style={styles.modernInfoRow}
                    onPress={() => {
                      const cleanPhone = caseData.customerPhone.replace(/\D/g, '');
                      const whatsappPhone = cleanPhone.startsWith('995') ? cleanPhone : `995${cleanPhone}`;
                      Linking.openURL(`whatsapp://send?phone=${whatsappPhone}`);
                    }}
                  >
                    <View style={[styles.infoIconContainer, { backgroundColor: '#25D36615' }]}>
                      <MaterialCommunityIcons name="whatsapp" size={22} color="#25D366" />
                    </View>
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>ტელეფონი</Text>
                      <Text style={styles.infoValue}>{caseData.customerPhone}</Text>
                    </View>
                  </TouchableOpacity>

                  <Divider style={styles.modernDivider} />

                  <View style={styles.modernInfoRow}>
                    <View style={[styles.infoIconContainer, { backgroundColor: COLORS.accent + '15' }]}>
                      <MaterialCommunityIcons name="car-outline" size={22} color={COLORS.accent} />
                    </View>
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>სახელმწიფო ნომერი</Text>
                      <Text style={styles.infoValue}>{caseData.plate || 'N/A'}</Text>
                    </View>
                  </View>

                  {(caseData.carMake || caseData.carModel) && (
                    <>
                      <Divider style={styles.modernDivider} />
                      <View style={styles.modernInfoRow}>
                        <View style={[styles.infoIconContainer, { backgroundColor: COLORS.primary + '15' }]}>
                          <MaterialCommunityIcons name="car-side" size={22} color={COLORS.primary} />
                        </View>
                        <View style={styles.infoTextContainer}>
                          <Text style={styles.infoLabel}>მარკა / მოდელი</Text>
                          <Text style={styles.infoValue}>
                            {[caseData.carMake, caseData.carModel].filter(Boolean).join(' ')}
                          </Text>
                        </View>
                      </View>
                    </>
                  )}
                </View>
              )}
            </Card.Content>
          </Card>

          {/* Internal Notes Card */}
          <Card style={styles.modernCard}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#F59E0B15' }]}>
                    <MaterialCommunityIcons name="note-text" size={20} color="#F59E0B" />
                  </View>
                  <Text style={styles.cardTitle}>შიდა შენიშვნები ({internalNotes.length})</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowAddNoteModal(true)}
                  style={styles.editIconButton}
                >
                  <MaterialCommunityIcons name="plus-circle" size={28} color="#F59E0B" />
                </TouchableOpacity>
              </View>

              {internalNotes.length === 0 ? (
                <View style={styles.emptyNotesContainer}>
                  <MaterialCommunityIcons name="note-outline" size={40} color={COLORS.text.disabled} />
                  <Text style={styles.emptyNotesText}>შენიშვნები არ არის</Text>
                  <TouchableOpacity
                    onPress={() => setShowAddNoteModal(true)}
                    style={styles.addNoteButton}
                  >
                    <MaterialCommunityIcons name="plus" size={18} color="#F59E0B" />
                    <Text style={styles.addNoteButtonText}>შენიშვნის დამატება</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.notesList}>
                  {internalNotes.map((note, index) => (
                    <View key={index} style={styles.noteItem}>
                      <View style={styles.noteHeader}>
                        <View style={styles.noteAuthorContainer}>
                          <MaterialCommunityIcons name="account-circle" size={18} color={COLORS.primary} />
                          <Text style={styles.noteAuthor}>{note.authorName}</Text>
                        </View>
                        <Text style={styles.noteDate}>{formatNoteDate(note.timestamp)}</Text>
                      </View>
                      <Text style={styles.noteText}>{note.text}</Text>
                      {index < internalNotes.length - 1 && <Divider style={styles.noteDivider} />}
                    </View>
                  ))}
                </View>
              )}
            </Card.Content>
          </Card>

          {/* Services Card - Enhanced */}
          <Card style={styles.modernCard}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: COLORS.success + '15' }]}>
                    <MaterialCommunityIcons name="wrench" size={20} color={COLORS.success} />
                  </View>
                  <Text style={styles.cardTitle}>სერვისები ({editMode ? editedServices.length : totalServices})</Text>
                </View>
                <View style={styles.cardHeaderActions}>
                  <TouchableOpacity
                    onPress={handleOpenAddServiceModal}
                    style={[styles.editIconButton, { marginRight: 8 }]}
                  >
                    <MaterialCommunityIcons name="plus-circle" size={28} color={COLORS.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleEditToggle}
                    style={styles.editIconButton}
                  >
                    <MaterialCommunityIcons
                      name={editMode ? "close-circle" : "pencil-circle"}
                      size={28}
                      color={editMode ? COLORS.error : COLORS.primary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.servicesList}>
                {(editMode ? editedServices : caseData.services)?.map((service: any, index: number) => {
                  const normalized = normalizeService(service);
                  return (
                    <View key={index}>
                      {editMode ? (
                        <View style={styles.editServiceContainer}>
                          <View style={styles.editServiceHeader}>
                            <View style={styles.serviceIconSmall}>
                              <MaterialCommunityIcons name="tools" size={16} color={COLORS.primary} />
                            </View>
                            <Text style={styles.editServiceName} numberOfLines={2}>
                              {getServiceNameGeorgian(normalized.serviceName)}
                            </Text>
                            <TouchableOpacity
                              onPress={() => handleDeleteService(index)}
                              style={styles.deleteButtonCompact}
                            >
                              <MaterialCommunityIcons name="close" size={18} color={COLORS.error} />
                            </TouchableOpacity>
                          </View>
                          <View style={styles.editServiceControls}>
                            <View style={styles.quantityControlGroup}>
                              <Text style={styles.controlLabel}>რაოდენობა</Text>
                              <View style={styles.quantityControl}>
                                <TouchableOpacity
                                  onPress={() => handleServiceCountChange(index, Math.max(1, normalized.count - 1).toString())}
                                  style={[styles.quantityButton, normalized.count <= 1 && styles.quantityButtonDisabled]}
                                  disabled={normalized.count <= 1}
                                >
                                  <MaterialCommunityIcons
                                    name="minus"
                                    size={18}
                                    color={normalized.count <= 1 ? COLORS.text.disabled : COLORS.primary}
                                  />
                                </TouchableOpacity>
                                <View style={styles.quantityDisplay}>
                                  <Text style={styles.quantityText}>{normalized.count}</Text>
                                </View>
                                <TouchableOpacity
                                  onPress={() => handleServiceCountChange(index, (normalized.count + 1).toString())}
                                  style={styles.quantityButton}
                                >
                                  <MaterialCommunityIcons name="plus" size={18} color={COLORS.primary} />
                                </TouchableOpacity>
                              </View>
                            </View>
                            <View style={styles.priceControlGroup}>
                              <Text style={styles.controlLabel}>ფასი</Text>
                              <TextInput
                                mode="outlined"
                                value={editedServices[index].price?.toString() || '0'}
                                onChangeText={(text) => handleServicePriceChange(index, text)}
                                keyboardType="numeric"
                                style={styles.priceInputEdit}
                                outlineStyle={styles.priceInputEditOutline}
                                dense
                                left={<TextInput.Affix text="₾" />}
                              />
                            </View>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.modernServiceRow}
                          onPress={() => handleOpenEditService(index)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.serviceLeft}>
                            <View style={styles.serviceIconSmall}>
                              <MaterialCommunityIcons name="tools" size={16} color={COLORS.primary} />
                            </View>
                            <View style={styles.serviceTextContainer}>
                              <View style={styles.serviceNameRow}>
                                <Text style={styles.modernServiceName}>{getServiceNameGeorgian(normalized.serviceName)}</Text>
                                {normalized.count > 1 && (
                                  <View style={styles.countBadge}>
                                    <Text style={styles.countBadgeText}>x{normalized.count}</Text>
                                  </View>
                                )}
                                {(service.discount_percent > 0) && (
                                  <View style={[styles.countBadge, { backgroundColor: COLORS.success + '20' }]}>
                                    <Text style={[styles.countBadgeText, { color: COLORS.success }]}>-{service.discount_percent}%</Text>
                                  </View>
                                )}
                              </View>
                              {normalized.description && (
                                <Text style={styles.serviceDescription}>{normalized.description}</Text>
                              )}
                            </View>
                          </View>
                          <View style={styles.servicePriceContainer}>
                            {service.discount_percent > 0 ? (
                              <>
                                <Text style={[styles.modernServicePrice, { textDecorationLine: 'line-through', color: COLORS.text.secondary, fontSize: 12 }]}>
                                  {formatCurrencyGEL(normalized.price)}
                                </Text>
                                <Text style={[styles.modernServicePrice, { color: COLORS.success }]}>
                                  {formatCurrencyGEL(normalized.price * (1 - (service.discount_percent || 0) / 100))}
                                </Text>
                              </>
                            ) : (
                              <Text style={styles.modernServicePrice}>{formatCurrencyGEL(normalized.price)}</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      )}
                      {index < (editMode ? editedServices : caseData.services).length - 1 &&
                        <Divider style={styles.modernDivider} />
                      }
                    </View>
                  );
                })}
              </View>

              {editMode && (
                <View style={styles.modernEditActions}>
                  <Button
                    mode="outlined"
                    onPress={handleEditToggle}
                    style={styles.modernButton}
                    textColor={COLORS.text.secondary}
                  >
                    გაუქმება
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleSaveChanges}
                    style={[styles.modernButton, styles.primaryButton]}
                    buttonColor={COLORS.primary}
                  >
                    შენახვა
                  </Button>
                </View>
              )}
            </Card.Content>
          </Card>

          {/* Parts Card */}
          {caseParts && caseParts.length > 0 && (
            <Card style={styles.modernCard}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.iconCircle, { backgroundColor: COLORS.accent + '15' }]}>
                      <MaterialCommunityIcons name="car-cog" size={20} color={COLORS.accent} />
                    </View>
                    <Text style={styles.cardTitle}>ნაწილები ({caseParts.length})</Text>
                  </View>
                </View>

                <View style={styles.servicesList}>
                  {caseParts.map((part: any, index: number) => (
                    <View key={part.id || `part-${index}`}>
                      <View style={styles.modernServiceRow}>
                        <View style={styles.serviceLeft}>
                          <View style={[styles.serviceIconSmall, { backgroundColor: COLORS.accent + '15' }]}>
                            <MaterialCommunityIcons name="cog" size={16} color={COLORS.accent} />
                          </View>
                          <View style={styles.serviceTextContainer}>
                            <View style={styles.serviceNameRow}>
                              <Text style={styles.modernServiceName}>
                                {part.nameKa || part.name || 'ნაწილი'}
                              </Text>
                              {(part.quantity || 1) > 1 && (
                                <View style={styles.countBadge}>
                                  <Text style={styles.countBadgeText}>x{part.quantity || 1}</Text>
                                </View>
                              )}
                            </View>
                            {part.partNumber && (
                              <Text style={styles.serviceDescription}>#{part.partNumber}</Text>
                            )}
                            {part.notes && (
                              <Text style={styles.serviceDescription}>{part.notes}</Text>
                            )}
                          </View>
                        </View>
                        <Text style={styles.modernServicePrice}>{formatCurrencyGEL(part.totalPrice || (part.unitPrice * (part.quantity || 1)))}</Text>
                      </View>
                      {index < caseParts.length - 1 && <Divider style={styles.modernDivider} />}
                    </View>
                  ))}
                </View>

                {/* Parts Total */}
                <View style={styles.servicesSubtotal}>
                  <Text style={styles.subtotalLabel}>ნაწილების ჯამი:</Text>
                  <Text style={styles.subtotalValue}>
                    {formatCurrencyGEL(caseParts.reduce((sum: number, p: any) => 
                      sum + (p.totalPrice || (p.unitPrice * (p.quantity || 1)) || 0), 0))}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          )}

          {/* Discounts & Totals Card */}
          <Card style={styles.modernCard}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: COLORS.success + '15' }]}>
                    <MaterialCommunityIcons name="percent" size={20} color={COLORS.success} />
                  </View>
                  <Text style={styles.cardTitle}>ფასდაკლებები და ჯამი</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowDiscountModal(true)}
                  style={styles.editIconButton}
                >
                  <MaterialCommunityIcons name="pencil-circle" size={28} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              {/* Subtotals */}
              <View style={styles.discountSummarySection}>
                <View style={styles.discountSummaryRow}>
                  <Text style={styles.discountSummaryLabel}>სერვისები:</Text>
                  <Text style={styles.discountSummaryValue}>{formatCurrencyGEL(getServicesSubtotal())}</Text>
                </View>
                {parseFloat(servicesDiscount) > 0 && (
                  <View style={styles.discountSummaryRow}>
                    <Text style={styles.discountAppliedLabel}>↳ ფასდაკლება ({servicesDiscount}%):</Text>
                    <Text style={styles.discountAppliedValue}>-{formatCurrencyGEL(getServicesSubtotal() * (parseFloat(servicesDiscount) / 100))}</Text>
                  </View>
                )}

                <View style={styles.discountSummaryRow}>
                  <Text style={styles.discountSummaryLabel}>ნაწილები:</Text>
                  <Text style={styles.discountSummaryValue}>{formatCurrencyGEL(getPartsSubtotal())}</Text>
                </View>
                {parseFloat(partsDiscount) > 0 && (
                  <View style={styles.discountSummaryRow}>
                    <Text style={styles.discountAppliedLabel}>↳ ფასდაკლება ({partsDiscount}%):</Text>
                    <Text style={styles.discountAppliedValue}>-{formatCurrencyGEL(getPartsSubtotal() * (parseFloat(partsDiscount) / 100))}</Text>
                  </View>
                )}

                {parseFloat(globalDiscount) > 0 && (
                  <View style={styles.discountSummaryRow}>
                    <Text style={styles.discountAppliedLabel}>საერთო ფასდაკლება ({globalDiscount}%):</Text>
                    <Text style={styles.discountAppliedValue}>-{formatCurrencyGEL((getServicesTotal() + getPartsTotal()) * (parseFloat(globalDiscount) / 100))}</Text>
                  </View>
                )}

                {/* VAT Checkbox */}
                <View style={styles.vatCheckboxRow}>
                  <View style={styles.vatCheckboxContainer}>
                    <Checkbox
                      status={includeVAT ? 'checked' : 'unchecked'}
                      onPress={handleVATToggle}
                      color={COLORS.primary}
                    />
                    <Text style={styles.vatCheckboxLabel}>დღგ +18%</Text>
                  </View>
                  {includeVAT && (
                    <Text style={styles.vatDisplayValue}>+{formatCurrencyGEL(getVATAmount())}</Text>
                  )}
                </View>
              </View>

              {/* Grand Total */}
              <View style={styles.grandTotalSection}>
                <Text style={styles.grandTotalLabel}>საბოლოო ჯამი:</Text>
                <Text style={styles.grandTotalValue}>{formatCurrencyGEL(getGrandTotal())}</Text>
              </View>

              {/* Quick Discount Button */}
              {parseFloat(servicesDiscount) === 0 && parseFloat(partsDiscount) === 0 && parseFloat(globalDiscount) === 0 && (
                <TouchableOpacity
                  style={styles.discountButton}
                  onPress={() => setShowDiscountModal(true)}
                >
                  <MaterialCommunityIcons name="tag-plus" size={20} color={COLORS.primary} />
                  <Text style={styles.discountButtonText}>ფასდაკლების დამატება</Text>
                </TouchableOpacity>
              )}
            </Card.Content>
          </Card>

          {/* Photos with Modern Gallery Layout */}
          <Card style={styles.modernCard}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: COLORS.warning + '15' }]}>
                    <MaterialCommunityIcons name="image-multiple" size={20} color={COLORS.warning} />
                  </View>
                  <Text style={styles.cardTitle}>
                    ფოტოები {caseData.photos && caseData.photos.length > 0 ? `(${caseData.photos.length})` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleAddPhotos}
                  style={styles.editIconButton}
                  disabled={isUploadingPhotos}
                >
                  {isUploadingPhotos ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <MaterialCommunityIcons name="plus-circle" size={28} color={COLORS.success} />
                  )}
                </TouchableOpacity>
              </View>

              {caseData.photos && caseData.photos.length > 0 ? (
                <View style={styles.photoGallery}>
                  {caseData.photos.map((photo: any, index: number) => (
                    <View key={index} style={styles.photoCardContainer}>
                      <TouchableOpacity
                        style={styles.modernPhotoCard}
                        onPress={() => handleImagePress(photo, index)}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: photo.url }} style={styles.modernPhotoImage} />
                        <View style={styles.modernPhotoOverlay}>
                          <Text style={styles.modernPhotoLabel}>{photo.label || `Photo ${index + 1}`}</Text>
                          {caseData.parts && caseData.parts.some((part: any) =>
                            part.damages?.some((d: any) => d.photoIndex === index)
                          ) && (
                            <View style={styles.taggedBadge}>
                              <MaterialCommunityIcons name="tag" size={12} color="#fff" />
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removePhotoButton}
                        onPress={() => handleRemovePhoto(index)}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons name="close-circle" size={24} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyPhotosContainer}>
                  <MaterialCommunityIcons name="image-plus" size={48} color={COLORS.text.disabled} />
                  <Text style={styles.emptyPhotosText}>ფოტოები არ არის დამატებული</Text>
                  <Text style={styles.emptyPhotosSubtext}>დააჭირეთ + ღილაკს ფოტოების დასამატებლად</Text>
                </View>
              )}
            </Card.Content>
          </Card>

          <View style={{ height: 120 }} />
        </Animated.View>
      </ScrollView>

      {/* Modern Floating Action Bar */}
      <Surface style={styles.modernBottomBar} elevation={8}>
        <TouchableOpacity
          style={[styles.modernBottomAction, styles.whatsappAction]}
          onPress={handleWhatsAppShare}
        >
          <MaterialCommunityIcons name="whatsapp" size={24} color="#fff" />
          <Text style={styles.modernBottomActionText}>WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modernBottomAction, styles.callAction]}
          onPress={() => Linking.openURL(`tel:${caseData.customerPhone}`)}
        >
          <MaterialCommunityIcons name="phone" size={24} color="#fff" />
          <Text style={styles.modernBottomActionText}>დარეკვა</Text>
        </TouchableOpacity>

        {caseData.status === 'Pending' && (
          <TouchableOpacity
            style={[styles.modernBottomAction, styles.startAction]}
            onPress={() => handleUpdateStatus('In Progress')}
          >
            <MaterialCommunityIcons name="play-circle" size={24} color="#fff" />
            <Text style={styles.modernBottomActionText}>დაწყება</Text>
          </TouchableOpacity>
        )}

        {caseData.status === 'In Progress' && (
          <TouchableOpacity
            style={[styles.modernBottomAction, styles.completeAction]}
            onPress={() => handleUpdateStatus('Completed')}
          >
            <MaterialCommunityIcons name="check-circle" size={24} color="#fff" />
            <Text style={styles.modernBottomActionText}>დასრულება</Text>
          </TouchableOpacity>
        )}
      </Surface>

      {/* Add Service Modal - Enhanced */}
      <Portal>
        <Modal
          visible={showAddServiceModal}
          onDismiss={() => setShowAddServiceModal(false)}
          contentContainerStyle={styles.modernModal}
        >
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={[styles.iconCircle, { backgroundColor: COLORS.success + '15' }]}>
                <MaterialCommunityIcons name="plus" size={20} color={COLORS.success} />
              </View>
              <Text style={styles.modalTitle}>სერვისის დამატება</Text>
            </View>
            <IconButton
              icon="close"
              size={24}
              onPress={() => setShowAddServiceModal(false)}
              iconColor={COLORS.text.primary}
            />
          </View>

          {loadingServices ? (
            <View style={styles.loadingServicesContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingServicesText}>იტვირთება...</Text>
            </View>
          ) : availableServices.length > 0 ? (
            <View style={styles.servicesListContainer}>
              <Text style={styles.servicesListTitle}>აირჩიეთ სერვისი:</Text>
              <ScrollView style={styles.servicesList} nestedScrollEnabled>
                {availableServices.map((service) => (
                  <TouchableOpacity
                    key={service.id}
                    style={[
                      styles.modernServiceItem,
                      selectedService?.id === service.id && styles.modernServiceItemSelected
                    ]}
                    onPress={() => handleSelectServiceFromDB(service)}
                  >
                    <Text style={styles.serviceItemName}>{service.nameKa || service.nameEn}</Text>
                    <Text style={styles.serviceItemPrice}>{formatCurrencyGEL(service.basePrice)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <Divider style={styles.modernDivider} />

          <TextInput
            label="სერვისის სახელი *"
            value={newServiceName}
            onChangeText={setNewServiceName}
            mode="outlined"
            style={styles.modernInput}
            outlineStyle={styles.inputOutline}
          />

          <View style={styles.priceCountRow}>
            <TextInput
              label="ფასი *"
              value={newServicePrice}
              onChangeText={setNewServicePrice}
              mode="outlined"
              keyboardType="numeric"
              style={[styles.modernInput, { flex: 1, marginRight: 12 }]}
              outlineStyle={styles.inputOutline}
              left={<TextInput.Affix text="₾" />}
            />
            <TextInput
              label="რაოდენობა"
              value={newServiceCount}
              onChangeText={setNewServiceCount}
              mode="outlined"
              keyboardType="numeric"
              style={[styles.modernInput, { width: 110 }]}
              outlineStyle={styles.inputOutline}
            />
          </View>

          <View style={styles.modernEditActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setShowAddServiceModal(false);
                setNewServiceName('');
                setNewServicePrice('');
                setNewServiceCount('1');
                setSelectedService(null);
              }}
              style={styles.modernButton}
              textColor={COLORS.text.secondary}
            >
              გაუქმება
            </Button>
            <Button
              mode="contained"
              onPress={handleAddService}
              style={[styles.modernButton, styles.primaryButton]}
              buttonColor={COLORS.primary}
              disabled={!newServiceName.trim() || !newServicePrice.trim()}
            >
              დამატება
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Edit Service Modal - Enhanced */}
      <Portal>
        <Modal
          visible={showEditServiceModal}
          onDismiss={() => setShowEditServiceModal(false)}
          contentContainerStyle={styles.editServiceModalContainer}
        >
          <View style={styles.editModalHeader}>
            <View style={styles.editModalHeaderTop}>
              <View style={styles.modalHeaderLeft}>
                <View style={[styles.iconCircleLarge, { backgroundColor: COLORS.primary + '10' }]}>
                  <MaterialCommunityIcons name="pencil" size={24} color={COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.modalTitleLarge}>სერვისის რედაქტირება</Text>
                  <Text style={styles.modalSubtitle}>შეცვალეთ სერვისის პარამეტრები</Text>
                </View>
              </View>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setShowEditServiceModal(false)}
                iconColor={COLORS.text.secondary}
                style={styles.closeButton}
              />
            </View>
          </View>

          <View style={styles.editModalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputGroupLabel}>სერვისის დასახელება</Text>
              <TextInput
                value={editServiceName}
                onChangeText={setEditServiceName}
                mode="outlined"
                placeholder="შეიყვანეთ სერვისის სახელი"
                style={styles.enhancedInput}
                outlineStyle={styles.enhancedInputOutline}
                activeOutlineColor={COLORS.primary}
                textColor={COLORS.text.primary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputGroupLabel}>აღწერა (არასავალდებულო)</Text>
              <TextInput
                value={editServiceDescription}
                onChangeText={setEditServiceDescription}
                mode="outlined"
                placeholder="დაამატეთ სერვისის აღწერა"
                style={[styles.enhancedInput, styles.multilineInput]}
                outlineStyle={styles.enhancedInputOutline}
                activeOutlineColor={COLORS.primary}
                textColor={COLORS.text.primary}
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1.5, marginRight: 12 }]}>
                <Text style={styles.inputGroupLabel}>ფასი (₾)</Text>
                <TextInput
                  value={editServicePrice}
                  onChangeText={setEditServicePrice}
                  mode="outlined"
                  keyboardType="numeric"
                  placeholder="0"
                  style={styles.enhancedInput}
                  outlineStyle={styles.enhancedInputOutline}
                  activeOutlineColor={COLORS.primary}
                  left={<TextInput.Icon icon="cash" color={COLORS.text.secondary} />}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputGroupLabel}>რაოდენობა</Text>
                <View style={styles.modalQuantityControl}>
                  <TouchableOpacity
                    onPress={() => handleEditServiceCountChange(Math.max(1, parseInt(editServiceCount) - 1).toString())}
                    style={[styles.modalQuantityButton, parseInt(editServiceCount) <= 1 && styles.quantityButtonDisabled]}
                    disabled={parseInt(editServiceCount) <= 1}
                  >
                    <MaterialCommunityIcons
                      name="minus"
                      size={20}
                      color={parseInt(editServiceCount) <= 1 ? COLORS.text.disabled : COLORS.primary}
                    />
                  </TouchableOpacity>
                  <View style={styles.modalQuantityDisplay}>
                    <Text style={styles.modalQuantityText}>{editServiceCount}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleEditServiceCountChange((parseInt(editServiceCount) + 1).toString())}
                    style={styles.modalQuantityButton}
                  >
                    <MaterialCommunityIcons name="plus" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Service Discount */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputGroupLabel}>ფასდაკლება (%)</Text>
              <TextInput
                value={editServiceDiscount}
                onChangeText={setEditServiceDiscount}
                mode="outlined"
                keyboardType="numeric"
                placeholder="0"
                style={styles.enhancedInput}
                outlineStyle={styles.enhancedInputOutline}
                activeOutlineColor={COLORS.primary}
                left={<TextInput.Icon icon="percent" color={COLORS.text.secondary} />}
              />
            </View>

            {/* Total Preview */}
            {editServicePrice && editServiceCount && (
              <View style={styles.totalPreviewCard}>
                <View style={styles.totalPreviewRow}>
                  <Text style={styles.totalPreviewLabel}>ფასი:</Text>
                  <Text style={[styles.totalPreviewAmount, parseFloat(editServiceDiscount) > 0 && { textDecorationLine: 'line-through', color: COLORS.text.secondary }]}>
                    {formatCurrencyGEL(parseFloat(editServicePrice) || 0)}
                  </Text>
                </View>
                {parseFloat(editServiceDiscount) > 0 && (
                  <View style={styles.totalPreviewRow}>
                    <Text style={[styles.totalPreviewLabel, { color: COLORS.success }]}>ფასდაკლებით:</Text>
                    <Text style={[styles.totalPreviewAmount, { color: COLORS.success }]}>
                      {formatCurrencyGEL((parseFloat(editServicePrice) || 0) * (1 - (parseFloat(editServiceDiscount) || 0) / 100))}
                    </Text>
                  </View>
                )}
                {parseInt(editServiceCount) > 1 && (
                  <Text style={styles.totalPreviewSubtext}>
                    {editServiceCount} × {formatCurrencyGEL((parseFloat(editServicePrice) || 0) / (parseInt(editServiceCount) || 1))}
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.editModalActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setShowEditServiceModal(false);
                setEditingServiceIndex(null);
                setEditServiceName('');
                setEditServiceDescription('');
                setEditServicePrice('');
                setEditServiceCount('1');
                setEditServiceDiscount('0');
              }}
              style={styles.cancelButton}
              labelStyle={styles.cancelButtonLabel}
              contentStyle={styles.buttonContent}
            >
              გაუქმება
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveEditedService}
              style={styles.saveButton}
              labelStyle={styles.saveButtonLabel}
              contentStyle={styles.buttonContent}
              buttonColor={COLORS.primary}
              disabled={!editServiceName.trim() || !editServicePrice.trim()}
              icon="check"
            >
              შენახვა
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Image Modal - Keep existing implementation */}
      <Portal>
        <Modal
          visible={showImageModal}
          onDismiss={() => {
            setShowImageModal(false);
            setShowTagWorkModal(false);
            setTaggingMode(false);
            setSelectedPartForTagging(null);
            setTagPosition({ x: 0, y: 0 });
            setShowPartSelector(false);
            scale.value = withSpring(1);
            savedScale.value = 1;
          }}
          contentContainerStyle={styles.imageModal}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            {selectedImage && (
              <View style={styles.imageModalContent}>
                <View style={styles.imageModalHeader}>
                  <Text style={styles.imageModalTitle}>{selectedImage.label || 'Photo'}</Text>
                  <View style={styles.headerActions}>
                    <TouchableOpacity
                      style={styles.tagWorkButton}
                      onPress={() => setShowTagWorkModal(true)}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons name="tag-plus" size={20} color={COLORS.primary} />
                      <Text style={styles.tagWorkButtonText}>Tag Work</Text>
                    </TouchableOpacity>
                    <IconButton
                      icon="refresh"
                      size={20}
                      onPress={() => {
                        scale.value = withSpring(1);
                        savedScale.value = 1;
                      }}
                      iconColor={COLORS.primary}
                    />
                    <IconButton
                      icon="close"
                      size={24}
                      onPress={() => {
                        setShowImageModal(false);
                        setShowTagWorkModal(false);
                        setTaggingMode(false);
                        setSelectedPartForTagging(null);
                        setTagPosition({ x: 0, y: 0 });
                        setShowPartSelector(false);
                        scale.value = withSpring(1);
                        savedScale.value = 1;
                      }}
                      iconColor={COLORS.text.primary}
                    />
                  </View>
                </View>

                <View style={styles.zoomInstruction}>
                  <MaterialCommunityIcons name="gesture-pinch" size={16} color={COLORS.text.secondary} />
                  <Text style={styles.zoomInstructionText}>Pinch to zoom • Tap refresh to reset</Text>
                </View>

              <View style={styles.imageContainer}>
                <TouchableOpacity
                  style={styles.imageWrapper}
                  activeOpacity={1}
                  onPressIn={(event) => {
                    if (!taggingMode) return;

                    const { locationX, locationY } = event.nativeEvent as any;
                    const { width: containerWidth, height: containerHeight } = containerDimensions || { width: 0, height: 0 };

                    // Guard: image must be laid out before tagging
                    if (!containerWidth || !containerHeight) {
                      Alert.alert('Please wait', 'Image not ready for tagging — try again in a moment.');
                      return;
                    }

                    // Calculate and clamp relative position (0..1)
                    const relativeX = Math.max(0, Math.min(1, locationX / containerWidth));
                    const relativeY = Math.max(0, Math.min(1, locationY / containerHeight));

                    setTagPosition({ x: relativeX, y: relativeY });
                    // Ensure the instruction modal isn't blocking touches
                    setShowTagWorkModal(false);
                    // Load available services if not already loaded (non-blocking)
                    if (!availableServices || availableServices.length === 0) {
                      loadAvailableServices().catch(()=>{});
                    }
                    setShowPartSelector(true);
                  }}
                  disabled={!taggingMode}
                >
                  <PinchGestureHandler
                    onGestureEvent={(event) => {
                      scale.value = savedScale.value * event.nativeEvent.scale;
                    }}
                    onHandlerStateChange={(event) => {
                      if (event.nativeEvent.oldState === State.ACTIVE) {
                        savedScale.value = scale.value;
                        if (scale.value < 1) {
                          scale.value = withSpring(1);
                          savedScale.value = 1;
                        } else if (scale.value > 3) {
                          scale.value = withSpring(3);
                          savedScale.value = 3;
                        }
                      }
                    }}
                  >
                    <Reanimated.View
                      style={[
                        styles.imageWrapper,
                        {
                          transform: [{ scale: scale }],
                        },
                      ]}
                      onLayout={(event) => {
                        const { width: w, height: h } = event.nativeEvent.layout;
                        setContainerDimensions({ width: w, height: h });

                        if (selectedImage && actualImageSize.width > 0 && actualImageSize.height > 0) {
                          const containerAspect = w / h;
                          const imageAspect = actualImageSize.width / actualImageSize.height;

                          let displayWidth, displayHeight;
                          if (imageAspect > containerAspect) {
                            displayWidth = w;
                            displayHeight = w / imageAspect;
                          } else {
                            displayHeight = h;
                            displayWidth = h * imageAspect;
                          }

                          setImageDimensions({ width: displayWidth, height: displayHeight });
                        }
                      }}
                    >
                      <Image
                        source={{ uri: selectedImage.url }}
                        style={styles.fullImage}
                        resizeMode="contain"
                        onLoad={(event) => {
                          const { width: imgW, height: imgH } = event.nativeEvent.source;
                          setActualImageSize({ width: imgW, height: imgH });

                          if (containerDimensions.width > 0 && containerDimensions.height > 0) {
                            const containerAspect = containerDimensions.width / containerDimensions.height;
                            const imageAspect = imgW / imgH;

                            let displayWidth, displayHeight;
                            if (imageAspect > containerAspect) {
                              displayWidth = containerDimensions.width;
                              displayHeight = containerDimensions.width / imageAspect;
                            } else {
                              displayHeight = containerDimensions.height;
                              displayWidth = containerDimensions.height * imageAspect;
                            }

                            setImageDimensions({ width: displayWidth, height: displayHeight });
                          }
                        }}
                      />

                      {imageDimensions.width > 0 && containerDimensions.width > 0 && caseData.parts && caseData.parts
                        .filter((part: any) => part.damages?.some((d: any) =>
                          selectedImageIndex === d.photoIndex
                        ))
                        .map((part: any) =>
                          part.damages
                            .filter((d: any) => selectedImageIndex === d.photoIndex)
                            .map((damage: any, idx: number) => {
                              const offsetX = (containerDimensions.width - imageDimensions.width) / 2;
                              const offsetY = (containerDimensions.height - imageDimensions.height) / 2;

                              let displayX, displayY;
                              if (damage.xPercent !== undefined && damage.yPercent !== undefined) {
                                displayX = (damage.xPercent * imageDimensions.width) + offsetX;
                                displayY = (damage.yPercent * imageDimensions.height) + offsetY;
                              } else {
                                const scaleX = imageDimensions.width / width;
                                const scaleY = imageDimensions.height / height;
                                displayX = (damage.x * scaleX) + offsetX;
                                displayY = (damage.y * scaleY) + offsetY;
                              }

                              return (
                                <View
                                  key={`${part.partName}-${idx}`}
                                  style={[
                                    styles.tagMarker,
                                    {
                                      left: displayX - 16,
                                      top: displayY - 16,
                                    },
                                  ]}
                                >
                                  <View style={styles.tagDot}>
                                    <MaterialCommunityIcons name="wrench" size={12} color="#fff" />
                                  </View>
                                </View>
                              );
                            })
                        )}

                      {/* Temporary tag marker during tagging */}
                      {taggingMode && tagPosition.x != null && tagPosition.y != null && !Number.isNaN(tagPosition.x) && !Number.isNaN(tagPosition.y) && (
                        <View
                          style={[
                            styles.tagMarker,
                            {
                              left: Math.max(0, (tagPosition.x * containerDimensions.width) - 16),
                              top: Math.max(0, (tagPosition.y * containerDimensions.height) - 16),
                            },
                          ]}
                        >
                          <View style={[styles.tagDot, { backgroundColor: COLORS.accent }]}>
                            <MaterialCommunityIcons name="plus" size={12} color="#fff" />
                          </View>
                        </View>
                      )}
                    </Reanimated.View>
                  </PinchGestureHandler>
                </TouchableOpacity>
              </View>

              {caseData.parts && (
                <View style={styles.taggedInfoContainer}>
                  <Text style={styles.taggedInfoTitle}>Tagged Work on this Photo:</Text>
                  {caseData.parts
                    .filter((part: any) => part.damages?.some((d: any) =>
                      selectedImageIndex === d.photoIndex
                    ))
                    .map((part: any, idx: number) => (
                      <View key={idx} style={styles.taggedPartCard}>
                        <MaterialCommunityIcons name="wrench" size={20} color={COLORS.primary} />
                        <View style={styles.taggedPartInfo}>
                          <Text style={styles.taggedPartName}>{part.partName}</Text>
                          {part.damages
                            .filter((d: any) => selectedImageIndex === d.photoIndex)
                            .map((damage: any, dIdx: number) => (
                              <View key={dIdx} style={styles.taggedServicesList}>
                                {damage.services.map((service: any, sIdx: number) => (
                                  <Text key={sIdx} style={styles.taggedServiceText}>
                                    • {service.name} - {formatCurrencyGEL(service.price)}
                                  </Text>
                                ))}
                              </View>
                            ))}
                        </View>
                      </View>
                    ))}
                  {caseData.parts.filter((part: any) => part.damages?.some((d: any) =>
                    selectedImageIndex === d.photoIndex
                  )).length === 0 && (
                    <Text style={styles.noTagsText}>No work tagged on this photo</Text>
                  )}
                </View>
              )}
            </View>
          )}
          </GestureHandlerRootView>
        </Modal>
      </Portal>

      {/* Discount Modal */}
      <Portal>
        <Modal
          visible={showDiscountModal}
          onDismiss={() => setShowDiscountModal(false)}
          contentContainerStyle={styles.discountModal}
        >
          <View style={styles.discountModalHeader}>
            <Text style={styles.discountModalTitle}>ფასდაკლებების რედაქტირება</Text>
            <IconButton
              icon="close"
              size={24}
              onPress={() => setShowDiscountModal(false)}
              iconColor={COLORS.text.primary}
            />
          </View>

          <View style={styles.discountModalContent}>
            {/* Services Discount */}
            <View style={styles.discountInputGroup}>
              <Text style={styles.discountInputLabel}>სერვისების ფასდაკლება (%)</Text>
              <TextInput
                value={servicesDiscount}
                onChangeText={setServicesDiscount}
                mode="outlined"
                keyboardType="numeric"
                placeholder="0"
                style={styles.discountInput}
                outlineStyle={styles.enhancedInputOutline}
                activeOutlineColor={COLORS.primary}
                right={<TextInput.Affix text="%" />}
              />
              {parseFloat(servicesDiscount) > 0 && (
                <Text style={styles.discountAmountPreview}>
                  -{formatCurrencyGEL(getServicesSubtotal() * (parseFloat(servicesDiscount) / 100))}
                </Text>
              )}
            </View>

            {/* Parts Discount */}
            <View style={styles.discountInputGroup}>
              <Text style={styles.discountInputLabel}>ნაწილების ფასდაკლება (%)</Text>
              <TextInput
                value={partsDiscount}
                onChangeText={setPartsDiscount}
                mode="outlined"
                keyboardType="numeric"
                placeholder="0"
                style={styles.discountInput}
                outlineStyle={styles.enhancedInputOutline}
                activeOutlineColor={COLORS.primary}
                right={<TextInput.Affix text="%" />}
              />
              {parseFloat(partsDiscount) > 0 && (
                <Text style={styles.discountAmountPreview}>
                  -{formatCurrencyGEL(getPartsSubtotal() * (parseFloat(partsDiscount) / 100))}
                </Text>
              )}
            </View>

            {/* Global Discount */}
            <View style={styles.discountInputGroup}>
              <Text style={styles.discountInputLabel}>საერთო ფასდაკლება (%)</Text>
              <TextInput
                value={globalDiscount}
                onChangeText={setGlobalDiscount}
                mode="outlined"
                keyboardType="numeric"
                placeholder="0"
                style={styles.discountInput}
                outlineStyle={styles.enhancedInputOutline}
                activeOutlineColor={COLORS.primary}
                right={<TextInput.Affix text="%" />}
              />
              {parseFloat(globalDiscount) > 0 && (
                <Text style={styles.discountAmountPreview}>
                  -{formatCurrencyGEL((getServicesTotal() + getPartsTotal()) * (parseFloat(globalDiscount) / 100))}
                </Text>
              )}
            </View>

            {/* Totals Preview */}
            <View style={styles.discountTotalsCard}>
              <View style={styles.discountTotalRow}>
                <Text style={styles.discountTotalLabel}>სერვისები (ფასდაკლებით):</Text>
                <Text style={styles.discountTotalValue}>{formatCurrencyGEL(getServicesTotal())}</Text>
              </View>
              <View style={styles.discountTotalRow}>
                <Text style={styles.discountTotalLabel}>ნაწილები (ფასდაკლებით):</Text>
                <Text style={styles.discountTotalValue}>{formatCurrencyGEL(getPartsTotal())}</Text>
              </View>
              <View style={[styles.discountTotalRow, styles.discountGrandTotal]}>
                <Text style={styles.discountGrandTotalLabel}>საბოლოო ჯამი:</Text>
                <Text style={styles.discountGrandTotalValue}>{formatCurrencyGEL(getGrandTotal())}</Text>
              </View>
            </View>
          </View>

          <View style={styles.discountModalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowDiscountModal(false)}
              style={styles.cancelButton}
              labelStyle={styles.cancelButtonLabel}
            >
              გაუქმება
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveDiscounts}
              style={styles.saveButton}
              labelStyle={styles.saveButtonLabel}
              buttonColor={COLORS.primary}
              icon="check"
            >
              შენახვა
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Workflow Status Edit Modal - Redesigned */}
      <Portal>
        <Modal
          visible={showWorkflowStatusModal}
          onDismiss={() => setShowWorkflowStatusModal(false)}
          contentContainerStyle={styles.workflowModal}
        >
          {/* Header */}
          <View style={styles.workflowModalHeader}>
            <View style={styles.workflowModalHeaderIcon}>
              <MaterialCommunityIcons name="clipboard-flow" size={24} color="#8B5CF6" />
            </View>
            <Text style={styles.workflowModalTitle}>სტატუსის რედაქტირება</Text>
            <IconButton
              icon="close"
              size={24}
              onPress={() => setShowWorkflowStatusModal(false)}
              iconColor={COLORS.text.secondary}
              style={styles.workflowModalClose}
            />
          </View>

          <ScrollView style={styles.workflowModalContent} showsVerticalScrollIndicator={false}>
            {/* Repair Status Section */}
            <View style={styles.workflowSection}>
              <View style={styles.workflowSectionHeader}>
                <MaterialCommunityIcons name="wrench" size={20} color="#8B5CF6" />
                <Text style={styles.workflowSectionTitle}>რემონტის სტატუსი</Text>
              </View>

              {/* Progress Steps */}
              <View style={styles.workflowStepsContainer}>
                {repairStatusOptions.map((option, index) => {
                  const isSelected = editingRepairStatus === option.value;
                  const currentIndex = repairStatusOptions.findIndex(o => o.value === editingRepairStatus);
                  const isPast = currentIndex > index && currentIndex !== -1;
                  const stepColor = option.value === null ? '#94A3B8' : getWorkflowStatusColor(option.value);

                  return (
                    <TouchableOpacity
                      key={option.value || 'null'}
                      style={[
                        styles.workflowStep,
                        isSelected && { backgroundColor: stepColor + '15', borderColor: stepColor },
                        isPast && { backgroundColor: stepColor + '08' }
                      ]}
                      onPress={() => setEditingRepairStatus(option.value)}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.workflowStepIndicator,
                        isSelected && { backgroundColor: stepColor },
                        isPast && { backgroundColor: stepColor, opacity: 0.5 }
                      ]}>
                        {isSelected ? (
                          <MaterialCommunityIcons name="check" size={14} color="#fff" />
                        ) : isPast ? (
                          <MaterialCommunityIcons name="check" size={12} color="#fff" />
                        ) : (
                          <Text style={styles.workflowStepNumber}>{index}</Text>
                        )}
                      </View>
                      <Text style={[
                        styles.workflowStepText,
                        isSelected && { color: stepColor, fontWeight: '600' },
                        isPast && { color: stepColor }
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* User Response Section */}
            <View style={styles.workflowSection}>
              <View style={styles.workflowSectionHeader}>
                <MaterialCommunityIcons name="clipboard-list" size={20} color="#10B981" />
                <Text style={styles.workflowSectionTitle}>საქმის სტატუსი</Text>
              </View>

              <View style={styles.userResponseGrid}>
                {caseStatusOptions.map((option) => {
                  const isSelected = editingCaseStatus === option.value;
                  const statusColor = option.color;

                  return (
                    <TouchableOpacity
                      key={option.value || 'null'}
                      style={[
                        styles.userResponseCard,
                        isSelected && { backgroundColor: statusColor + '15', borderColor: statusColor }
                      ]}
                      onPress={() => setEditingCaseStatus(option.value)}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.userResponseIconContainer,
                        isSelected && { backgroundColor: statusColor + '20' }
                      ]}>
                        <MaterialCommunityIcons
                          name={option.icon as any}
                          size={24}
                          color={isSelected ? statusColor : '#94A3B8'}
                        />
                      </View>
                      <Text style={[
                        styles.userResponseText,
                        isSelected && { color: statusColor, fontWeight: '600' }
                      ]}>
                        {option.label}
                      </Text>
                      {isSelected && (
                        <View style={[styles.userResponseCheckmark, { backgroundColor: statusColor }]}>
                          <MaterialCommunityIcons name="check" size={12} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.workflowModalActions}>
            <TouchableOpacity
              style={styles.workflowCancelButton}
              onPress={() => setShowWorkflowStatusModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.workflowCancelButtonText}>გაუქმება</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.workflowSaveButton}
              onPress={handleSaveWorkflowStatuses}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="check" size={20} color="#fff" />
              <Text style={styles.workflowSaveButtonText}>შენახვა</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </Portal>

      {/* Add Internal Note Modal */}
      <Portal>
        <Modal
          visible={showAddNoteModal}
          onDismiss={() => {
            setShowAddNoteModal(false);
            setNewNoteText('');
          }}
          contentContainerStyle={styles.addNoteModal}
        >
          <View style={styles.addNoteModalHeader}>
            <View style={styles.addNoteModalTitleRow}>
              <MaterialCommunityIcons name="note-plus" size={24} color="#F59E0B" />
              <Text style={styles.addNoteModalTitle}>შენიშვნის დამატება</Text>
            </View>
            <IconButton
              icon="close"
              size={24}
              onPress={() => {
                setShowAddNoteModal(false);
                setNewNoteText('');
              }}
              iconColor={COLORS.text.primary}
            />
          </View>

          <View style={styles.addNoteModalContent}>
            <TextInput
              label="შენიშვნა"
              value={newNoteText}
              onChangeText={setNewNoteText}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={styles.noteTextInput}
              outlineStyle={styles.inputOutline}
              placeholder="შეიყვანეთ შენიშვნა..."
            />
          </View>

          <View style={styles.addNoteModalActions}>
            <TouchableOpacity
              style={styles.noteCancelButton}
              onPress={() => {
                setShowAddNoteModal(false);
                setNewNoteText('');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.noteCancelButtonText}>გაუქმება</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.noteSaveButton, savingNote && styles.noteSaveButtonDisabled]}
              onPress={handleAddInternalNote}
              activeOpacity={0.8}
              disabled={savingNote}
            >
              {savingNote ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="check" size={20} color="#fff" />
                  <Text style={styles.noteSaveButtonText}>შენახვა</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Modal>
      </Portal>

      {/* Photo Source Selection Modal */}
      <Portal>
        <Modal
          visible={showPhotoSourceModal}
          onDismiss={() => setShowPhotoSourceModal(false)}
          contentContainerStyle={styles.photoSourceModal}
        >
          <View style={styles.photoSourceModalHeader}>
            <Text style={styles.photoSourceModalTitle}>ფოტოს დამატება</Text>
            <IconButton
              icon="close"
              size={24}
              onPress={() => setShowPhotoSourceModal(false)}
              iconColor={COLORS.text.primary}
            />
          </View>

          <View style={styles.photoSourceModalContent}>
            <TouchableOpacity
              style={styles.photoSourceOption}
              onPress={handleTakePhoto}
              activeOpacity={0.8}
            >
              <View style={[styles.photoSourceIcon, { backgroundColor: COLORS.primary + '15' }]}>
                <MaterialCommunityIcons name="camera" size={32} color={COLORS.primary} />
              </View>
              <Text style={styles.photoSourceTitle}>გადაიღეთ ფოტო</Text>
              <Text style={styles.photoSourceSubtitle}>გამოიყენეთ კამერა ახალი ფოტოს გადასაღებად</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoSourceOption}
              onPress={handleSelectFromGallery}
              activeOpacity={0.8}
            >
              <View style={[styles.photoSourceIcon, { backgroundColor: COLORS.success + '15' }]}>
                <MaterialCommunityIcons name="image-multiple" size={32} color={COLORS.success} />
              </View>
              <Text style={styles.photoSourceTitle}>აირჩიეთ გალერეიდან</Text>
              <Text style={styles.photoSourceSubtitle}>აირჩიეთ ფოტოები თქვენი გალერეიდან</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </Portal>

      {/* Tag Work Modal */}
      <Portal>
        <Modal
          visible={showTagWorkModal}
          onDismiss={() => {
            setShowTagWorkModal(false);
            setTaggingMode(false);
            setSelectedPartForTagging(null);
            setTagPosition({ x: 0, y: 0 });
          }}
          contentContainerStyle={styles.tagWorkModal}
        >
          <View style={styles.tagWorkModalHeader}>
            <Text style={styles.tagWorkModalTitle}>Tag Work on Photo</Text>
            <IconButton
              icon="close"
              size={24}
              onPress={() => {
                setShowTagWorkModal(false);
                setTaggingMode(false);
                setSelectedPartForTagging(null);
                setTagPosition({ x: 0, y: 0 });
              }}
              iconColor={COLORS.text.primary}
            />
          </View>

          <View style={styles.tagWorkModalContent}>
            {!taggingMode ? (
              <View style={styles.tagInstructions}>
                <MaterialCommunityIcons name="gesture-tap" size={48} color={COLORS.primary} />
                <Text style={styles.tagInstructionsTitle}>Tap on the photo to tag work</Text>
                <Text style={styles.tagInstructionsText}>
                  Select a location on the photo where the work needs to be done, then choose the part and services.
                </Text>
                <Button
                  mode="contained"
                  onPress={() => {
                    // Close the instruction modal so taps reach the photo and enable tagging
                    setShowTagWorkModal(false);
                    setTaggingMode(true);
                    setTagPosition({ x: 0, y: 0 });
                    setShowPartSelector(false);
                  }}
                  style={styles.startTaggingButton}
                  buttonColor={COLORS.primary}
                  icon="tag-plus"
                >
                  Start Tagging
                </Button>
              </View>
            ) : (
              <View style={styles.taggingInterface}>
                <Text style={styles.taggingInstructions}>
                  Tap on the photo where you want to tag work
                </Text>
                <Button
                  mode="outlined"
                  onPress={() => {
                    setTaggingMode(false);
                    setSelectedPartForTagging(null);
                    setTagPosition({ x: 0, y: 0 });
                  }}
                  style={styles.cancelTaggingButton}
                >
                  Cancel Tagging
                </Button>
              </View>
            )}
          </View>
        </Modal>
      </Portal>

      {/* Part Selector Modal */}
      <Portal>
        <Modal
          visible={showPartSelector}
          onDismiss={() => {
            setShowPartSelector(false);
            setSelectedPartForTagging(null);
          }}
          contentContainerStyle={styles.partSelectorModal}
        >
          <View style={styles.partSelectorModalHeader}>
            <Text style={styles.partSelectorModalTitle}>Select Part & Services</Text>
            <IconButton
              icon="close"
              size={24}
              onPress={() => {
                setShowPartSelector(false);
                setSelectedPartForTagging(null);
              }}
              iconColor={COLORS.text.primary}
            />
          </View>

          <View style={styles.partSelectorModalContent}>
            <Text style={styles.partSelectorInstructions}>
              Choose a part and the services needed for this location
            </Text>

            {/* Existing parts (if any) */}
            {caseParts && caseParts.length > 0 ? (
              <ScrollView style={styles.partsList} showsVerticalScrollIndicator={false}>
                {caseParts.map((part: any, index: number) => (
                  <TouchableOpacity
                    key={part.id || `part-${index}`}
                    style={[
                      styles.partSelectorItem,
                      selectedPartForTagging?.id === part.id && styles.partSelectorItemSelected
                    ]}
                    onPress={() => {
                      setSelectedPartForTagging(part);
                      // reset selected services for a fresh selection (could prefill from existing damages in future)
                      setSelectedServicesForTagging([]);
                      // ensure available services are loaded
                      if (!availableServices || availableServices.length === 0) loadAvailableServices().catch(()=>{});
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.partSelectorItemLeft}>
                      <View style={[styles.partIcon, { backgroundColor: COLORS.primary + '15' }]}>
                        <MaterialCommunityIcons name="cog" size={20} color={COLORS.primary} />
                      </View>
                      <View>
                        <Text style={styles.partSelectorItemName}>
                          {part.nameKa || part.name || 'Part'}
                        </Text>
                        {part.partNumber && (
                          <Text style={styles.partSelectorItemNumber}>#{part.partNumber}</Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.partSelectorItemPrice}>
                      {formatCurrencyGEL(part.unitPrice || part.totalPrice || 0)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={{ marginVertical: 8 }}>
                <Text style={[styles.partSelectorInstructions, { marginBottom: 12, textAlign: 'center' }]}>No parts found for this case — create a new part to tag work</Text>
              </View>
            )}

            {/* Create new part (always available) */}
            <View style={{ marginTop: 12, gap: 8 }}>
              <TextInput
                label="New part name"
                value={newPartName}
                onChangeText={setNewPartName}
                mode="outlined"
                style={styles.modernInput}
                outlineStyle={styles.inputOutline}
                placeholder="e.g. Front bumper"
              />
              <TextInput
                label="Part number (optional)"
                value={newPartNumber}
                onChangeText={setNewPartNumber}
                mode="outlined"
                style={styles.modernInput}
                outlineStyle={styles.inputOutline}
                placeholder="#12345"
              />

              <Text style={[styles.inputGroupLabel, { marginTop: 8 }]}>Select services for this tag</Text>

              {/* Services list (uses availableServices, falls back to DEFAULT_SERVICES) */}
              {loadingServicesForTagging ? (
                <View style={styles.loadingServicesContainer}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
                  {(availableServices && availableServices.length > 0 ? availableServices : Object.values(DEFAULT_SERVICES)).map((svc: any, i: number) => {
                    const svcId = svc.id || svc.nameEn || svc.name || `svc-${i}`;
                    const svcName = svc.nameKa || svc.nameEn || svc.name || svc.description || 'Service';
                    const svcPrice = svc.basePrice ?? svc.price ?? svc.rate ?? 0;
                    const checked = selectedServicesForTagging.some(s => (s._id || s.id || s.name) === (svc._id || svcId || svcName));

                    return (
                      <TouchableOpacity
                        key={svcId}
                        style={[styles.modernServiceItem, checked && styles.modernServiceItemSelected]}
                        onPress={() => {
                          if (checked) {
                            setSelectedServicesForTagging(prev => prev.filter(p => (p._id || p.id || p.name) !== (svc._id || svcId || svcName)));
                          } else {
                            setSelectedServicesForTagging(prev => [...prev, { name: svcName, price: svcPrice, id: svcId }]);
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.serviceItemName}>{svcName}</Text>
                        <Text style={styles.serviceItemPrice}>{formatCurrencyGEL(svcPrice)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Selected-part actions (works for existing or newly-entered part) */}
            {(selectedPartForTagging || newPartName.trim().length > 0) && (
              <View style={styles.selectedPartActions}>
                <Text style={styles.selectedPartText}>
                  {selectedPartForTagging ? `Selected: ${selectedPartForTagging.nameKa || selectedPartForTagging.name}` : `New part: ${newPartName}`}
                </Text>
                <View style={styles.partSelectorActions}>
                  <Button
                    mode="outlined"
                    onPress={() => {
                      setSelectedPartForTagging(null);
                      setNewPartName('');
                      setNewPartNumber('');
                      setSelectedServicesForTagging([]);
                      setShowPartSelector(false);
                      setTaggingMode(false);
                      setTagPosition({ x: 0, y: 0 });
                    }}
                    style={styles.cancelPartButton}
                  >
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleSaveTag}
                    style={styles.saveTagButton}
                    buttonColor={COLORS.primary}
                    icon="check"
                  >
                    Tag Work
                  </Button>
                </View>
              </View>
            )}
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.text.secondary,
    fontSize: 16,
    fontWeight: '500',
  },

  // Modern Header
  header: {
    backgroundColor: '#fff',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    marginRight: 12,
  },
  backButtonCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text.primary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncButtonDisabled: {
    backgroundColor: COLORS.background,
  },
  shareButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.success + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },

  // Hero Card
  heroCard: {
    margin: 16,
    marginTop: 8,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 4,
  },
  heroGradient: {
    background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
    backgroundColor: COLORS.primary,
  },
  heroContent: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusSection: {
    flex: 1,
  },
  statusBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 6,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  heroPhone: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 15,
    marginTop: 12,
  },
  totalSection: {
    alignItems: 'flex-end',
    position: 'relative',
  },
  totalLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  totalValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 4,
  },
  priceDot: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: '#fff',
  },

  // Workflow Status Styles
  workflowStatusContainer: {
    gap: 12,
  },
  workflowStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  workflowStatusLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workflowLabelText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  workflowStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  workflowStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // New Workflow Modal Styles
  workflowModal: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 24,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  workflowModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  workflowModalHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#8B5CF6' + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  workflowModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.primary,
    flex: 1,
  },
  workflowModalClose: {
    margin: 0,
  },
  workflowModalContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  workflowSection: {
    marginBottom: 24,
  },
  workflowSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  workflowSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  workflowStepsContainer: {
    gap: 8,
  },
  workflowStep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  workflowStepIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  workflowStepNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  workflowStepText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.secondary,
    flex: 1,
  },
  userResponseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  userResponseCard: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  userResponseIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  userResponseText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text.secondary,
    flex: 1,
  },
  userResponseCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workflowModalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  workflowCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workflowCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  workflowSaveButton: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  workflowSaveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // Internal Notes styles
  emptyNotesContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyNotesText: {
    fontSize: 14,
    color: COLORS.text.disabled,
    marginTop: 8,
    marginBottom: 16,
  },
  addNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F59E0B15',
    gap: 6,
  },
  addNoteButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#F59E0B',
  },
  notesList: {
    marginTop: 8,
  },
  noteItem: {
    paddingVertical: 12,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteAuthorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noteAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  noteDate: {
    fontSize: 12,
    color: COLORS.text.disabled,
  },
  noteText: {
    fontSize: 14,
    color: COLORS.text.primary,
    lineHeight: 20,
  },
  noteDivider: {
    marginTop: 12,
    backgroundColor: '#F1F5F9',
  },

  // Add Note Modal styles
  addNoteModal: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    maxHeight: '60%',
  },
  addNoteModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  addNoteModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addNoteModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  addNoteModalContent: {
    padding: 20,
  },
  noteTextInput: {
    backgroundColor: '#fff',
    minHeight: 120,
  },
  addNoteModalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  noteCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  noteSaveButton: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  noteSaveButtonDisabled: {
    opacity: 0.7,
  },
  noteSaveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // Legacy workflow styles (kept for compatibility)
  workflowEditSection: {
    marginBottom: 20,
  },
  workflowEditLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  workflowOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  workflowOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  workflowOptionSelected: {
    backgroundColor: '#8B5CF6' + '15',
    borderColor: '#8B5CF6',
  },
  workflowOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  workflowOptionTextSelected: {
    color: '#8B5CF6',
    fontWeight: '600',
  },

  // Modern Cards
  modernCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    elevation: 2,
    backgroundColor: '#fff',
  },
  cardContent: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  editIconButton: {
    padding: 0,
  },

  // Info List
  infoList: {
    gap: 0,
  },
  modernInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  infoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },

  // Services List
  servicesList: {
    marginTop: 4,
  },
  modernServiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  serviceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serviceIconSmall: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  serviceTextContainer: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
  },
  serviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modernServiceName: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text.primary,
  },
  serviceDescription: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  modernServiceCount: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  modernServicePrice: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primary,
  },
  servicePriceContainer: {
    alignItems: 'flex-end',
  },
  countChip: {
    height: 22,
    backgroundColor: COLORS.primary + '15',
  },
  countChipText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  countBadge: {
    backgroundColor: COLORS.primary + '15',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Edit Mode
  editForm: {
    gap: 16,
  },
  modernInput: {
    backgroundColor: '#fff',
  },
  inputOutline: {
    borderRadius: 12,
    borderColor: COLORS.outline,
  },
  modernEditActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modernButton: {
    flex: 1,
    borderRadius: 12,
  },
  primaryButton: {
    elevation: 0,
  },
  editServiceContainer: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  editServiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  editServiceName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginLeft: 8,
  },
  deleteButtonCompact: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.error + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  editServiceControls: {
    flexDirection: 'row',
    gap: 12,
  },
  quantityControlGroup: {
    flex: 1,
  },
  priceControlGroup: {
    flex: 1,
  },
  controlLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editServiceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  editServiceInfo: {
    flex: 1,
  },
  editServiceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.outline,
    overflow: 'hidden',
  },
  quantityButton: {
    width: 36,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityDisplay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  priceInputEdit: {
    backgroundColor: '#fff',
    fontSize: 16,
  },
  priceInputEditOutline: {
    borderRadius: 10,
    borderColor: COLORS.outline,
  },
  quantityInput: {
    width: 50,
    backgroundColor: '#fff',
    textAlign: 'center',
  },
  quantityInputOutline: {
    borderRadius: 6,
  },
  modernPriceInput: {
    width: 100,
    backgroundColor: '#fff',
  },
  priceInputOutline: {
    borderRadius: 8,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.error + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modern Photos
  modernPhotoScroll: {
    marginTop: 16,
    marginHorizontal: -4,
  },
  modernPhotoCard: {
    width: 180,
    height: 140,
    marginHorizontal: 4,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    backgroundColor: '#fff',
  },
  modernPhotoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.backgroundDark,
  },
  modernPhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modernPhotoLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  taggedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modern Bottom Bar
  modernBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: 10,
  },
  modernBottomAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
  },
  whatsappAction: {
    backgroundColor: '#25D366',
  },
  callAction: {
    backgroundColor: COLORS.primary,
  },
  startAction: {
    backgroundColor: COLORS.warning,
  },
  completeAction: {
    backgroundColor: COLORS.success,
  },
  modernBottomActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  // Modern Modal
  modernModal: {
    margin: 20,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  loadingServicesContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingServicesText: {
    marginTop: 8,
    color: COLORS.text.secondary,
  },
  servicesListContainer: {
    maxHeight: 200,
    marginBottom: 16,
  },
  servicesListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: 12,
  },
  modernServiceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modernServiceItemSelected: {
    backgroundColor: COLORS.primary + '10',
    borderColor: COLORS.primary,
  },
  serviceItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text.primary,
    flex: 1,
  },
  serviceItemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  priceCountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  modernDivider: {
    backgroundColor: COLORS.outline,
    marginVertical: 16,
  },

  // Edit Service Modal - Enhanced Styles
  editServiceModalContainer: {
    margin: 0,
    backgroundColor: '#fff',
    borderRadius: 28,
    marginHorizontal: 16,
    maxHeight: '75%',
    overflow: 'hidden',
  },
  editModalHeader: {
    backgroundColor: COLORS.background,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
  },
  editModalHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconCircleLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  modalTitleLarge: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  closeButton: {
    margin: 0,
  },
  editModalContent: {
    padding: 20,
    gap: 18,
  },
  inputGroup: {
    gap: 8,
  },
  inputGroupLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  enhancedInput: {
    backgroundColor: '#fff',
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 80,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  enhancedInputOutline: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.outline,
  },
  // Discount inputs in modal
  discountsSectionInModal: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  discountsSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  discountInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  discountInputWrapper: {
    flex: 1,
  },
  discountInputLabelSmall: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.text.tertiary,
    marginBottom: 4,
  },
  discountInputSmall: {
    backgroundColor: '#fff',
    fontSize: 14,
    height: 44,
  },
  discountInputOutline: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  totalPreviewCard: {
    backgroundColor: COLORS.primary + '08',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
    marginTop: 4,
  },
  totalPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalPreviewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  totalPreviewAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
  },
  totalPreviewSubtext: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    marginTop: 6,
    textAlign: 'right',
  },
  editModalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.outline,
  },
  cancelButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  saveButton: {
    flex: 1,
    borderRadius: 14,
    elevation: 0,
  },
  saveButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  buttonContent: {
    paddingVertical: 8,
  },
  modalQuantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.outline,
    overflow: 'hidden',
    height: 56,
  },
  modalQuantityButton: {
    width: 48,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  modalQuantityDisplay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    minWidth: 50,
  },
  modalQuantityText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },

  // Image Modal (keep existing styles)
  imageModal: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    maxHeight: '90%',
  },
  imageModalContent: {
    flex: 1,
  },
  imageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  imageModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  zoomInstruction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 6,
    backgroundColor: COLORS.primary + '10',
  },
  zoomInstructionText: {
    fontSize: 11,
    color: COLORS.text.secondary,
  },
  fullImage: {
    width: width - 32,
    height: 280,
  },
  imageContainer: {
    width: width - 32,
    height: 280,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  tagMarker: {
    position: 'absolute',
    zIndex: 10,
  },
  tagDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 4,
  },
  taggedInfoContainer: {
    padding: 16,
    maxHeight: 200,
  },
  taggedInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  taggedPartCard: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  taggedPartInfo: {
    flex: 1,
    marginLeft: 10,
  },
  taggedPartName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  taggedServicesList: {
    marginTop: 4,
  },
  taggedServiceText: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginBottom: 2,
  },
  noTagsText: {
    fontSize: 13,
    color: COLORS.text.tertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginTop: 12,
    marginBottom: 8,
  },
  carMakeModelRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfInput: {
    flex: 1,
  },
  // Parts subtotal styles
  servicesSubtotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  subtotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  subtotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  // Discount Modal Styles
  discountModal: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  discountModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  discountModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  discountModalContent: {
    gap: 16,
  },
  discountInputGroup: {
    gap: 6,
  },
  discountInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  discountInput: {
    backgroundColor: '#fff',
  },
  discountAmountPreview: {
    fontSize: 13,
    color: COLORS.success,
    fontWeight: '500',
    marginTop: 4,
  },
  discountTotalsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    gap: 10,
  },
  discountTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discountTotalLabel: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  discountTotalValue: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  discountGrandTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  discountGrandTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  discountGrandTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  discountModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  // Discount Button Style
  discountButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  discountButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.primary + '10',
    borderRadius: 12,
    gap: 8,
  },
  discountButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  discountBadge: {
    backgroundColor: COLORS.success,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  discountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  // Discount Summary Section (in Card)
  discountSummarySection: {
    gap: 8,
    marginBottom: 16,
  },
  discountSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discountSummaryLabel: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  discountSummaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  discountAppliedLabel: {
    fontSize: 13,
    color: COLORS.success,
    paddingLeft: 12,
  },
  discountAppliedValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.success,
  },
  vatDisplayLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    paddingLeft: 0,
  },
  vatDisplayValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  vatCheckboxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  vatCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vatCheckboxLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginLeft: 4,
  },
  grandTotalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1.5,
    borderTopColor: COLORS.primary + '30',
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  grandTotalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  // Photo Gallery Styles
  photoGallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  photoCardContainer: {
    position: 'relative',
  },
  modernPhotoCard: {
    width: (width - 16 * 2 - 20 * 2 - 12) / 2, // Two columns with gap
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    elevation: 2,
  },
  modernPhotoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  modernPhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modernPhotoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  taggedBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  emptyPhotosContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyPhotosText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginTop: 12,
    textAlign: 'center',
  },
  emptyPhotosSubtext: {
    fontSize: 14,
    color: COLORS.text.tertiary,
    marginTop: 4,
    textAlign: 'center',
  },
  // Photo Source Modal Styles
  photoSourceModal: {
    margin: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 0,
    maxWidth: 400,
    alignSelf: 'center',
  },
  photoSourceModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
  },
  photoSourceModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  photoSourceModalContent: {
    padding: 20,
    gap: 16,
  },
  photoSourceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  photoSourceIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  photoSourceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  photoSourceSubtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    flex: 1,
  },
  // Tag Work Modal Styles
  tagWorkModal: {
    margin: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 0,
    maxWidth: 400,
    alignSelf: 'center',
  },
  tagWorkModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
  },
  tagWorkModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  tagWorkModalContent: {
    padding: 20,
  },
  tagInstructions: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  tagInstructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  tagInstructionsText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  startTaggingButton: {
    minWidth: 150,
  },
  taggingInterface: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  taggingInstructions: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  cancelTaggingButton: {
    minWidth: 120,
  },
  tagWorkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  tagWorkButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 4,
  },
  // Part Selector Modal Styles
  partSelectorModal: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 0,
    maxHeight: '80%',
  },
  partSelectorModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
  },
  partSelectorModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  partSelectorModalContent: {
    padding: 20,
  },
  partSelectorInstructions: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  partsList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  partSelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  partSelectorItemSelected: {
    backgroundColor: COLORS.primary + '10',
    borderColor: COLORS.primary,
  },
  partSelectorItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  partIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  partSelectorItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  partSelectorItemNumber: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  partSelectorItemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  selectedPartActions: {
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
    paddingTop: 20,
  },
  selectedPartText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  partSelectorActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelPartButton: {
    flex: 1,
  },
  saveTagButton: {
    flex: 1,
  },
});
