import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView, PinchGestureHandler, State } from 'react-native-gesture-handler';
import {
  ActivityIndicator,
  Button,
  Card,
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
import { ServiceService } from '../../src/services/serviceService';
import { formatCurrencyGEL } from '../../src/utils/helpers';

const { width, height } = Dimensions.get('window');

export default function CaseDetailScreen() {
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedServices, setEditedServices] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<any>(null);
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

  const normalizeService = (service: any) => {
    // Prioritize Georgian name (serviceNameKa) over English (serviceName)
    const georgianName = service.serviceNameKa || service.nameKa || '';
    const englishName = service.serviceName || service.serviceNameEn || service.name || 'Unknown Service';
    
    return {
      serviceName: georgianName || getServiceNameGeorgian(englishName) || englishName,
      serviceNameKa: georgianName || getServiceNameGeorgian(englishName),
      serviceNameEn: englishName,
      description: service.description || '',
      price: service.price || service.hourly_rate || service.rate || 0,
      count: service.count || 1,
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

  const getGrandTotal = () => {
    const subtotal = getServicesTotal() + getPartsTotal();
    const discount = (parseFloat(globalDiscount) || 0) / 100;
    return Math.max(0, subtotal - (subtotal * discount));
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
        carModel: cpanelData.carModel || caseData.carModel,
        plate: cpanelData.plate || caseData.plate,
        totalPrice: cpanelData.totalPrice || caseData.totalPrice,
        status: cpanelData.status || caseData.status,
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
        carModel: updatedData.carModel,
        plate: updatedData.plate,
        totalPrice: updatedData.totalPrice,
        status: updatedData.status,
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
      setEditedCarModel(updatedData.carModel || '');
      setEditedPlate(updatedData.plate || '');
      // Update discount state
      setServicesDiscount(String(updatedData.services_discount_percent || 0));
      setPartsDiscount(String(updatedData.parts_discount_percent || 0));
      setGlobalDiscount(String(updatedData.global_discount_percent || 0));

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

      if (hasGlobalDiscountChanges || hasServiceDiscountChanges) {
        console.log('[Case Detail] Silent sync: Discount changes detected, updating Firebase');
        
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
          totalPrice: cpanelData.totalPrice || currentData.totalPrice,
        });

        // Update local state
        setServicesDiscount(String(cpanelData.services_discount_percent || 0));
        setPartsDiscount(String(cpanelData.parts_discount_percent || 0));
        setGlobalDiscount(String(cpanelData.global_discount_percent || 0));
        setCaseData((prev: any) => ({
          ...prev,
          services: updatedServices,
          services_discount_percent: cpanelData.services_discount_percent ?? 0,
          parts_discount_percent: cpanelData.parts_discount_percent ?? 0,
          global_discount_percent: cpanelData.global_discount_percent ?? 0,
          totalPrice: cpanelData.totalPrice || prev.totalPrice,
        }));
        setEditedServices(updatedServices);

        console.log('[Case Detail] Silent sync: Discounts updated from cPanel');
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
      const { db } = require('../../src/services/firebase');
      const { doc, getDoc } = require('firebase/firestore');

      const docRef = doc(db, 'inspections', id as string);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setCaseData(data);
        setEditedServices(data.services || []);
        setCaseParts(data.parts || []);
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
      
      console.log('[Case Detail] Saving service:', {
        serviceName: georgianName,
        price: serviceBasePrice,
        discount_percent: serviceDiscountPercent,
      });

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

  const handleImagePress = (photo: any) => {
    setSelectedImage(photo);
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
                    {formatCurrencyGEL(caseParts.reduce((sum: number, p: any) => sum + (p.totalPrice || (p.unitPrice * (p.quantity || 1)) || 0), 0))}
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
          {caseData.photos && caseData.photos.length > 0 && (
            <Card style={styles.modernCard}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.iconCircle, { backgroundColor: COLORS.warning + '15' }]}>
                      <MaterialCommunityIcons name="image-multiple" size={20} color={COLORS.warning} />
                    </View>
                    <Text style={styles.cardTitle}>ფოტოები ({caseData.photos.length})</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modernPhotoScroll}>
                  {caseData.photos.map((photo: any, index: number) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.modernPhotoCard}
                      onPress={() => handleImagePress(photo)}
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
                  ))}
                </ScrollView>
              </Card.Content>
            </Card>
          )}

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
                        caseData.photos.findIndex((p: any) => p.url === selectedImage.url) === d.photoIndex
                      ))
                      .map((part: any) =>
                        part.damages
                          .filter((d: any) => caseData.photos.findIndex((p: any) => p.url === selectedImage.url) === d.photoIndex)
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
                  </Reanimated.View>
                </PinchGestureHandler>
              </View>

              {caseData.parts && (
                <View style={styles.taggedInfoContainer}>
                  <Text style={styles.taggedInfoTitle}>Tagged Work on this Photo:</Text>
                  {caseData.parts
                    .filter((part: any) => part.damages?.some((d: any) =>
                      caseData.photos.findIndex((p: any) => p.url === selectedImage.url) === d.photoIndex
                    ))
                    .map((part: any, idx: number) => (
                      <View key={idx} style={styles.taggedPartCard}>
                        <MaterialCommunityIcons name="wrench" size={20} color={COLORS.primary} />
                        <View style={styles.taggedPartInfo}>
                          <Text style={styles.taggedPartName}>{part.partName}</Text>
                          {part.damages
                            .filter((d: any) => caseData.photos.findIndex((p: any) => p.url === selectedImage.url) === d.photoIndex)
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
                    caseData.photos.findIndex((p: any) => p.url === selectedImage.url) === d.photoIndex
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
});
