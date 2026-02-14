import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
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

import AsyncStorage from '@react-native-async-storage/async-storage';

import { CarSelector, SelectedCar } from '../../src/components/common/CarSelector';
import { COLORS } from '../../src/config/constants';
import { DEFAULT_SERVICES } from '../../src/config/services';
import { fetchInvoiceFromCPanel, fetchMechanicsFromCPanel } from '../../src/services/cpanelService';
import { ServiceService } from '../../src/services/serviceService';
import { sendCompletionSMS } from '../../src/services/smsService';
import statusService, { Status } from '../../src/services/statusService';
import { formatCurrencyGEL } from '../../src/utils/helpers';

const { width, height } = Dimensions.get('window');

// SMS Recipient interface
interface SMSRecipient {
  id: string;
  name: string;
  phone: string;
  enabled: boolean;
}

// Default SMS recipients
const DEFAULT_SMS_RECIPIENTS: SMSRecipient[] = [
  { id: '1', name: 'თამუნა', phone: '598745777', enabled: true },
  { id: '2', name: 'ნიკა', phone: '511144486', enabled: true },
  { id: '3', name: 'სალარო', phone: '579191929', enabled: false },
];

const SMS_RECIPIENTS_STORAGE_KEY = 'smsRecipients';

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
  const [nachrebiQty, setNachrebiQty] = useState('');
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
  const [editServiceBaseUnitPrice, setEditServiceBaseUnitPrice] = useState(0); // Track base unit price for accurate recalculation

  // Parts state
  const [caseParts, setCaseParts] = useState<any[]>([]);
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [newPartNameInput, setNewPartNameInput] = useState('');
  const [newPartNumberInput, setNewPartNumberInput] = useState('');
  const [newPartPrice, setNewPartPrice] = useState('');
  const [newPartQuantity, setNewPartQuantity] = useState('1');
  const [newPartNotes, setNewPartNotes] = useState('');

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
  const [repairStatusId, setRepairStatusId] = useState<number | null>(null);
  const [caseStatusId, setCaseStatusId] = useState<number | null>(null);
  const [showWorkflowStatusModal, setShowWorkflowStatusModal] = useState(false);
  const [editingRepairStatus, setEditingRepairStatus] = useState<string | null>(null);
  const [editingCaseStatus, setEditingCaseStatus] = useState<string | null>(null);
  const [editingRepairStatusId, setEditingRepairStatusId] = useState<number | null>(null);
  const [editingCaseStatusId, setEditingCaseStatusId] = useState<number | null>(null);

  // Statuses from database
  const [caseStatuses, setCaseStatuses] = useState<Status[]>([]);
  const [repairStatuses, setRepairStatuses] = useState<Status[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);

  // Case type state (დაზღვევა / საცალო)
  const [caseType, setCaseType] = useState<string | null>(null);
  const [showCaseTypeModal, setShowCaseTypeModal] = useState(false);

  // Insurance fields (visible when caseType = 'დაზღვევა')
  const [insuranceCompany, setInsuranceCompany] = useState<string>('');
  const [claimNumber, setClaimNumber] = useState<string>('');
  const [adjusterName, setAdjusterName] = useState<string>('');
  const [adjusterPhone, setAdjusterPhone] = useState<string>('');
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Assigned mechanic state
  const [assignedMechanic, setAssignedMechanic] = useState<string | null>(null);
  const [showMechanicModal, setShowMechanicModal] = useState(false);
  const [editingMechanic, setEditingMechanic] = useState<string>('');
  const [savingMechanic, setSavingMechanic] = useState(false);
  const [mechanicOptions, setMechanicOptions] = useState<Array<{value: string | null; label: string}>>([
    { value: null, label: 'არ არის მინიჭებული' }
  ]);
  const [loadingMechanics, setLoadingMechanics] = useState(false);

  // Nachrebi Qty modal state
  const [showNachrebiQtyModal, setShowNachrebiQtyModal] = useState(false);
  const [editingNachrebiQty, setEditingNachrebiQty] = useState<string>('');

  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Photo upload state
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [showPhotoSourceModal, setShowPhotoSourceModal] = useState(false);

  // Internal notes state
  const [internalNotes, setInternalNotes] = useState<Array<{text: string; timestamp: string; authorName: string}>>([]);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Voice notes state
  const [voiceNotes, setVoiceNotes] = useState<Array<{url: string; timestamp: string; authorName: string; duration?: number}>>([]);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [savingVoiceNote, setSavingVoiceNote] = useState(false);
  const [playingVoiceNote, setPlayingVoiceNote] = useState<string | null>(null);
  const [soundObject, setSoundObject] = useState<Audio.Sound | null>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Payments state
  const [payments, setPayments] = useState<Array<{
    id: number;
    transferId: number;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    method: string;
    reference: string;
    notes: string;
    recordedBy: string;
    currency: string;
  }>>([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Transfer'>('Cash');
  const [transferMethod, setTransferMethod] = useState<'BOG' | 'TBC'>('BOG');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // SMS state
  const [smsSent, setSmsSent] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [smsSettingsVisible, setSmsSettingsVisible] = useState(false);
  const [smsRecipients, setSmsRecipients] = useState<SMSRecipient[]>(DEFAULT_SMS_RECIPIENTS);
  const [editingRecipient, setEditingRecipient] = useState<string | null>(null);
  const [editingPhone, setEditingPhone] = useState('');

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
    loadStatuses(); // Load statuses when component mounts
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

  // Refresh function to reload case data from CPanel/Firebase
  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      console.log('[Case Detail] Manual refresh triggered');
      await loadCaseDetails();
      console.log('[Case Detail] Manual refresh completed');
    } catch (error) {
      console.error('[Case Detail] Refresh error:', error);
      Alert.alert('შეცდომა', 'მონაცემების განახლება ვერ მოხერხდა');
    } finally {
      setIsRefreshing(false);
    }
  };

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
      'წინასწარი შეფასება': '#6366F1', // Blue - Initial assessment
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
      case 'In Service': return '#EC4899';
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
      case 'In Service': return 'სერვისშია';
      case 'Completed': return 'დასრულებული';
      case 'Issue': return 'პრობლემა';
      default: return status;
    }
  };

  // Workflow status options
  const repairStatusOptions = [
    { value: null, label: 'არ არის' },
    { value: 'წინასწარი შეფასება', label: 'წინასწარი შეფასება' },
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
    { value: 'In Service', label: 'სერვისშია', icon: 'car-wrench', color: '#EC4899' },
    { value: 'Completed', label: 'დასრულებული', icon: 'check-circle', color: '#10B981' },
    { value: 'Issue', label: 'პრობლემა', icon: 'alert-circle', color: '#EF4444' },
  ];

  // Case type options
  const caseTypeOptions = [
    { value: null, label: 'არ არის', icon: 'minus-circle-outline', color: '#94A3B8' },
    { value: 'დაზღვევა', label: 'დაზღვევა', icon: 'shield-car', color: '#3B82F6' },
    { value: 'საცალო', label: 'საცალო', icon: 'cash', color: '#10B981' },
  ];

  const getCaseTypeColor = (type: string | null): string => {
    const option = caseTypeOptions.find(opt => opt.value === type);
    return option?.color || '#94A3B8';
  };

  const getCaseTypeLabel = (type: string | null): string => {
    if (!type) return 'არ არის';
    const option = caseTypeOptions.find(opt => opt.value === type);
    return option?.label || type;
  };

  const getCaseTypeIcon = (type: string | null): string => {
    const option = caseTypeOptions.find(opt => opt.value === type);
    return option?.icon || 'minus-circle-outline';
  };

  const handleOpenWorkflowStatusModal = () => {
    setEditingRepairStatus(repairStatus);
    setEditingCaseStatus(caseStatus);
    setEditingRepairStatusId(repairStatusId);
    setEditingCaseStatusId(caseStatusId);
    setShowWorkflowStatusModal(true);
  };

  const handleSaveWorkflowStatuses = async () => {
    try {
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());

      // Send both IDs and legacy string values for backwards compatibility
      const updateData: any = {
        repair_status: editingRepairStatus,
        status: editingCaseStatus,
        repair_status_id: editingRepairStatusId,
        status_id: editingCaseStatusId,
      };

      // Track when status_id changes so "days in service" is calculated from this moment
      if (editingCaseStatusId !== caseStatusId) {
        updateData.statusChangedAt = new Date().toISOString();
      }

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
      setRepairStatusId(editingRepairStatusId);
      setCaseStatusId(editingCaseStatusId);
      setCaseData((prev: any) => ({
        ...prev,
        repair_status: editingRepairStatus,
        status: editingCaseStatus,
        repair_status_id: editingRepairStatusId,
        status_id: editingCaseStatusId,
      }));

      setShowWorkflowStatusModal(false);
      Alert.alert('✅ წარმატება', 'სტატუსი განახლდა');
    } catch (error) {
      console.error('Error saving workflow statuses:', error);
      Alert.alert('❌ შეცდომა', 'სტატუსის განახლება ვერ მოხერხდა');
    }
  };

  const handleSaveCaseType = async (newCaseType: string | null) => {
    try {
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());

      const updateData = {
        caseType: newCaseType,
      };

      console.log('[Case Detail] Saving case type:', updateData, 'cpanelId:', cpanelId);

      // Update CPanel first if we have cpanel ID
      if (cpanelId) {
        const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
        const cpanelResult = await updateInvoiceToCPanel(cpanelId, updateData);
        console.log('[Case Detail] CPanel case type update result:', cpanelResult);
      }

      // Update Firebase
      if (!isCpanelOnly) {
        const { updateInspection } = require('../../src/services/firebase');
        await updateInspection(id as string, updateData, cpanelId || undefined);
      }

      // Update local state
      setCaseType(newCaseType);
      setCaseData((prev: any) => ({
        ...prev,
        caseType: newCaseType,
      }));

      setShowCaseTypeModal(false);
      Alert.alert('✅ წარმატება', 'საქმის ტიპი განახლდა');
    } catch (error) {
      console.error('Error saving case type:', error);
      Alert.alert('❌ შეცდომა', 'საქმის ტიპის განახლება ვერ მოხერხდა');
    }
  };

  const loadMechanics = async () => {
    try {
      setLoadingMechanics(true);
      const result = await fetchMechanicsFromCPanel();
      
      if (result.success && result.mechanics) {
        const options: Array<{value: string | null; label: string}> = [
          { value: null, label: 'არ არის მინიჭებული' }
        ];
        
        result.mechanics.forEach((mechanic: {id: number; name: string}) => {
          options.push({ value: mechanic.name, label: mechanic.name });
        });
        
        setMechanicOptions(options);
        console.log('[Case Detail] Loaded mechanics:', options.length - 1);
      }
    } catch (error) {
      console.error('Error loading mechanics:', error);
    } finally {
      setLoadingMechanics(false);
    }
  };

  const handleOpenMechanicModal = () => {
    setEditingMechanic(assignedMechanic || '');
    setShowMechanicModal(true);
    loadMechanics(); // Load mechanics when modal opens
  };

  const handleOpenNachrebiQtyModal = () => {
    setEditingNachrebiQty(nachrebiQty || '');
    setShowNachrebiQtyModal(true);
  };

  // Load statuses from cPanel database
  const loadStatuses = async () => {
    try {
      setLoadingStatuses(true);
      const statuses = await statusService.getStatuses();
      setCaseStatuses(statuses.case_status);
      setRepairStatuses(statuses.repair_status);
      console.log('[Case Detail] Loaded statuses:', {
        caseStatuses: statuses.case_status.length,
        repairStatuses: statuses.repair_status.length
      });
    } catch (error) {
      console.error('[Case Detail] Error loading statuses:', error);
      // Continue without statuses - use legacy string-based system
    } finally {
      setLoadingStatuses(false);
    }
  };

  // Get status object by ID
  const getStatusById = (id: number | null, type: 'case_status' | 'repair_status'): Status | null => {
    if (!id) return null;
    const statusList = type === 'case_status' ? caseStatuses : repairStatuses;
    return statusList.find(s => s.id === id) || null;
  };

  // Get status display info (supports both ID-based and legacy string-based)
  const getStatusDisplay = (statusId: number | null, legacyStatus: string | null, type: 'case_status' | 'repair_status') => {
    // Try ID-based first
    if (statusId) {
      const status = getStatusById(statusId, type);
      if (status) {
        return {
          name: status.name,
          color: status.color,
          bgColor: status.bgColor,
          icon: status.icon
        };
      }
    }
    
    // Fallback to legacy string-based
    if (legacyStatus) {
      // Use the old hardcoded colors
      const color = type === 'case_status' ? getCaseStatusColor(legacyStatus) : getWorkflowStatusColor(legacyStatus);
      return {
        name: legacyStatus,
        color: color,
        bgColor: color + '15',
        icon: type === 'case_status' ? 'file-document' : 'wrench'
      };
    }
    
    return {
      name: 'არ არის',
      color: '#94A3B8',
      bgColor: '#94A3B815',
      icon: 'minus-circle-outline'
    };
  };

  const handleSaveMechanic = async (newMechanic: string | null) => {
    try {
      setSavingMechanic(true);
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());

      const updateData = {
        assignedMechanic: newMechanic,
        assigned_mechanic: newMechanic, // For cPanel database column name
      };

      console.log('[Case Detail] Saving assigned mechanic:', updateData, 'cpanelId:', cpanelId);

      // Update CPanel first if we have cpanel ID
      if (cpanelId) {
        const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
        const cpanelResult = await updateInvoiceToCPanel(cpanelId, updateData);
        console.log('[Case Detail] CPanel mechanic update result:', cpanelResult);
      }

      // Update Firebase
      if (!isCpanelOnly) {
        const { updateInspection } = require('../../src/services/firebase');
        await updateInspection(id as string, { assignedMechanic: newMechanic }, cpanelId || undefined);
      }

      // Update local state
      setAssignedMechanic(newMechanic);
      setCaseData((prev: any) => ({
        ...prev,
        assignedMechanic: newMechanic,
      }));

      setShowMechanicModal(false);
      Alert.alert('✅ წარმატება', 'მექანიკოსი მინიჭებულია');
    } catch (error) {
      console.error('Error saving mechanic:', error);
      Alert.alert('❌ შეცდომა', 'მექანიკოსის მინიჭება ვერ მოხერხდა');
    } finally {
      setSavingMechanic(false);
    }
  };

  const handleSaveNachrebiQty = async () => {
    try {
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());

      const updateData = {
        nachrebi_qty: editingNachrebiQty || null
      };

      console.log('[Case Detail] Saving nachrebi_qty:', updateData, 'cpanelId:', cpanelId);

      // Update CPanel first if we have cpanel ID
      if (cpanelId) {
        const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
        const cpanelResult = await updateInvoiceToCPanel(cpanelId, updateData);
        console.log('[Case Detail] CPanel nachrebi_qty update result:', cpanelResult);
      }

      // Update Firebase
      if (!isCpanelOnly) {
        const { updateInspection } = require('../../src/services/firebase');
        await updateInspection(id as string, { nachrebi_qty: editingNachrebiQty || null }, cpanelId || undefined);
      }

      // Update local state
      setNachrebiQty(editingNachrebiQty);
      setCaseData((prev: any) => ({
        ...prev,
        nachrebi_qty: editingNachrebiQty || null,
      }));

      setShowNachrebiQtyModal(false);
      Alert.alert('✅ წარმატება', 'ნაჭრების რაოდენობა განახლდა');
    } catch (error) {
      console.error('Error saving nachrebi_qty:', error);
      Alert.alert('❌ შეცდომა', 'ნაჭრების რაოდენობის განახლება ვერ მოხერხდა');
    }
  };

  // SMS Functions
  const SMS_STORAGE_KEY = 'sentSmsIds';
  
  // Load SMS recipients from AsyncStorage
  const loadSmsRecipients = async () => {
    try {
      const stored = await AsyncStorage.getItem(SMS_RECIPIENTS_STORAGE_KEY);
      if (stored) {
        const savedRecipients: SMSRecipient[] = JSON.parse(stored);
        // Merge with defaults to ensure all recipients exist
        const mergedRecipients = DEFAULT_SMS_RECIPIENTS.map(defaultRecipient => {
          const saved = savedRecipients.find(s => s.id === defaultRecipient.id);
          if (saved) {
            return { ...defaultRecipient, phone: saved.phone, enabled: saved.enabled };
          }
          return defaultRecipient;
        });
        setSmsRecipients(mergedRecipients);
      }
    } catch (error) {
      console.error('Error loading SMS recipients:', error);
    }
  };

  // Save SMS recipients to AsyncStorage
  const saveSmsRecipients = async (recipients: SMSRecipient[]) => {
    try {
      await AsyncStorage.setItem(SMS_RECIPIENTS_STORAGE_KEY, JSON.stringify(recipients));
      setSmsRecipients(recipients);
    } catch (error) {
      console.error('Error saving SMS recipients:', error);
    }
  };

  // Toggle recipient enabled status
  const toggleRecipient = (recipientId: string) => {
    const updated = smsRecipients.map(r => 
      r.id === recipientId ? { ...r, enabled: !r.enabled } : r
    );
    saveSmsRecipients(updated);
  };

  // Start editing phone number
  const startEditingPhone = (recipient: SMSRecipient) => {
    setEditingRecipient(recipient.id);
    setEditingPhone(recipient.phone);
  };

  // Save edited phone number
  const saveEditedPhone = () => {
    if (editingRecipient && editingPhone.trim()) {
      const updated = smsRecipients.map(r => 
        r.id === editingRecipient ? { ...r, phone: editingPhone.trim() } : r
      );
      saveSmsRecipients(updated);
    }
    setEditingRecipient(null);
    setEditingPhone('');
  };

  // Cancel editing
  const cancelEditingPhone = () => {
    setEditingRecipient(null);
    setEditingPhone('');
  };

  // Get enabled recipients
  const getEnabledRecipients = () => {
    return smsRecipients.filter(r => r.enabled);
  };
  
  const loadSmsSentStatus = async () => {
    try {
      const caseKey = `${isCpanelOnly ? 'cpanel' : 'firebase'}-${id}`;
      const stored = await AsyncStorage.getItem(SMS_STORAGE_KEY);
      if (stored) {
        const sentIds = JSON.parse(stored) as string[];
        setSmsSent(sentIds.includes(caseKey));
      }
    } catch (error) {
      console.error('Error loading SMS status:', error);
    }
  };

  const markSmsSent = async () => {
    try {
      const caseKey = `${isCpanelOnly ? 'cpanel' : 'firebase'}-${id}`;
      const stored = await AsyncStorage.getItem(SMS_STORAGE_KEY);
      const sentIds = stored ? JSON.parse(stored) as string[] : [];
      if (!sentIds.includes(caseKey)) {
        sentIds.push(caseKey);
        await AsyncStorage.setItem(SMS_STORAGE_KEY, JSON.stringify(sentIds));
      }
      setSmsSent(true);
    } catch (error) {
      console.error('Error saving SMS status:', error);
    }
  };

  const handleSendCompletionSMS = async () => {
    const enabledRecipients = getEnabledRecipients();
    
    if (enabledRecipients.length === 0) {
      Alert.alert(
        'შეცდომა', 
        'SMS მიმღებები არ არის არჩეული. გთხოვთ აირჩიოთ მინიმუმ ერთი მიმღები პარამეტრებში.',
        [
          { text: 'გაუქმება', style: 'cancel' },
          { text: 'პარამეტრები', onPress: () => setSmsSettingsVisible(true) }
        ]
      );
      return;
    }
    
    const plate = caseData?.plate || 'N/A';
    const totalPrice = caseData?.totalPrice || 0;
    const caseTypeLabel = caseType || 'არ არის მითითებული';
    const mechanicName = assignedMechanic;
    
    // Build recipient list for display
    const recipientNames = enabledRecipients.map(r => `${r.name} (${r.phone})`).join(', ');
    
    // Build alert message
    let alertMessage = `${smsSent ? '⚠️ SMS უკვე გაგზავნილია!\n\n' : ''}გსურთ დასრულების შეტყობინების გაგზავნა?\n\nმიმღებები: ${recipientNames}\n\nავტომობილი: ${plate}\nტიპი: ${caseTypeLabel}`;
    if (caseType === 'დაზღვევა' && mechanicName) {
      alertMessage += `\nმექანიკოსი: ${mechanicName}`;
    }
    alertMessage += `\nჯამი: ${totalPrice.toFixed(2)} ₾`;
    
    Alert.alert(
      smsSent ? 'SMS ხელახლა გაგზავნა' : 'SMS გაგზავნა',
      alertMessage,
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: smsSent ? 'ხელახლა გაგზავნა' : 'გაგზავნა',
          onPress: async () => {
            try {
              setSendingSms(true);
              
              // Send SMS to all enabled recipients
              const results = await Promise.all(
                enabledRecipients.map(recipient => 
                  sendCompletionSMS(
                    recipient.phone,
                    plate,
                    totalPrice,
                    caseType,
                    mechanicName
                  )
                )
              );
              
              const successCount = results.filter(r => r.success).length;
              const failCount = results.filter(r => !r.success).length;
              
              if (successCount > 0) {
                await markSmsSent();
                if (failCount > 0) {
                  Alert.alert('ნაწილობრივი წარმატება', `${successCount} SMS გაგზავნილია, ${failCount} ვერ გაიგზავნა`);
                } else {
                  Alert.alert('წარმატება ✓', `SMS წარმატებით გაიგზავნა ${successCount} მიმღებზე!`);
                }
              } else {
                Alert.alert('შეცდომა', 'SMS გაგზავნა ვერ მოხერხდა');
              }
            } catch (error) {
              console.error('SMS error:', error);
              Alert.alert('შეცდომა', 'SMS გაგზავნა ვერ მოხერხდა');
            } finally {
              setSendingSms(false);
            }
          }
        }
      ]
    );
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

      // Fetch latest notes from CPanel to merge (prevents overwriting notes added from CPanel)
      let latestNotes: Array<{text: string; timestamp: string; authorName: string}> = [...internalNotes];

      if (cpanelId) {
        try {
          const cpanelData = await fetchInvoiceFromCPanel(cpanelId);
          if (cpanelData?.internalNotes && Array.isArray(cpanelData.internalNotes)) {
            // Merge notes: use CPanel notes as base, avoiding duplicates
            const cpanelNotes = cpanelData.internalNotes;
            const mergedNotes = [...cpanelNotes];

            // Add any local notes that aren't in CPanel (by timestamp comparison)
            internalNotes.forEach(localNote => {
              const exists = cpanelNotes.some((cpNote: any) =>
                cpNote.timestamp === localNote.timestamp && cpNote.text === localNote.text
              );
              if (!exists) {
                mergedNotes.push(localNote);
              }
            });

            latestNotes = mergedNotes;
            console.log('[Case Detail] Merged notes from CPanel:', latestNotes.length, 'total notes');
          }
        } catch (fetchError) {
          console.log('[Case Detail] Could not fetch latest notes from CPanel, using local state');
        }
      }

      // Add the new note
      const updatedNotes = [...latestNotes, newNote];

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

  const handleDeleteInternalNote = async (noteIndex: number) => {
    Alert.alert(
      'შენიშვნის წაშლა',
      'ნამდვილად გსურთ ამ შენიშვნის წაშლა?',
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: 'წაშლა',
          style: 'destructive',
          onPress: async () => {
            try {
              const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());

              // Remove the note at the specified index
              const updatedNotes = internalNotes.filter((_, index) => index !== noteIndex);

              const updateData = {
                internalNotes: updatedNotes,
              };

              console.log('[Case Detail] Deleting internal note at index:', noteIndex);

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
              Alert.alert('✅ წარმატება', 'შენიშვნა წაიშალა');
            } catch (error) {
              console.error('Error deleting internal note:', error);
              Alert.alert('❌ შეცდომა', 'შენიშვნის წაშლა ვერ მოხერხდა');
            }
          },
        },
      ]
    );
  };

  // ==================== Voice Notes Functions ====================
  
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startVoiceRecording = async () => {
    try {
      // Clean up any existing recording first
      if (voiceRecording) {
        try {
          await voiceRecording.stopAndUnloadAsync();
        } catch (e) {
          // Ignore cleanup errors
        }
        setVoiceRecording(null);
      }

      console.log('[Voice Notes] Requesting permissions...');
      const { status } = await Audio.requestPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('შეცდომა', 'მიკროფონის წვდომა საჭიროა ხმოვანი ჩანაწერისთვის');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('[Voice Notes] Starting recording...');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setVoiceRecording(recording);
      setIsRecordingVoice(true);
      setRecordingDuration(0);

      // Start duration counter
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('[Voice Notes] Failed to start recording:', error);
      Alert.alert('შეცდომა', 'ჩაწერის დაწყება ვერ მოხერხდა');
    }
  };

  const stopVoiceRecording = async () => {
    try {
      if (!voiceRecording) return;

      console.log('[Voice Notes] Stopping recording...');
      
      // Clear the interval
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      setIsRecordingVoice(false);
      await voiceRecording.stopAndUnloadAsync();
      
      const uri = voiceRecording.getURI();
      const duration = recordingDuration;
      
      setVoiceRecording(null);
      setRecordingDuration(0);

      if (uri) {
        // Upload the voice note
        await uploadVoiceNote(uri, duration);
      }
    } catch (error) {
      console.error('[Voice Notes] Failed to stop recording:', error);
      setIsRecordingVoice(false);
      setVoiceRecording(null);
      setRecordingDuration(0);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      Alert.alert('შეცდომა', 'ჩაწერის შეწყვეტა ვერ მოხერხდა');
    }
  };

  const cancelVoiceRecording = async () => {
    try {
      if (voiceRecording) {
        await voiceRecording.stopAndUnloadAsync();
      }
    } catch (e) {
      // Ignore errors when canceling
    }
    
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    setIsRecordingVoice(false);
    setVoiceRecording(null);
    setRecordingDuration(0);
  };

  const uploadVoiceNote = async (uri: string, duration: number) => {
    try {
      setSavingVoiceNote(true);
      
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
      const storageId = isCpanelOnly ? `cpanel_${id}` : (id as string);
      
      // Upload to Firebase Storage
      const { uploadVoiceNoteToStorage, updateInspection } = require('../../src/services/firebase');
      const downloadURL = await uploadVoiceNoteToStorage(uri, storageId);
      
      const newVoiceNote = {
        url: downloadURL,
        timestamp: new Date().toISOString(),
        authorName: 'მობილური აპი',
        duration: duration,
      };

      // Get current voice notes
      const updatedVoiceNotes = [...voiceNotes, newVoiceNote];
      
      const updateData = {
        voiceNotes: updatedVoiceNotes,
      };

      // Update CPanel if we have cpanel ID
      if (cpanelId) {
        const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
        await updateInvoiceToCPanel(cpanelId, updateData);
      }

      // Update Firebase
      if (!isCpanelOnly) {
        await updateInspection(id as string, updateData, cpanelId || undefined);
      }

      // Update local state
      setVoiceNotes(updatedVoiceNotes);
      Alert.alert('✅ წარმატება', 'ხმოვანი ჩანაწერი შეინახა');
    } catch (error) {
      console.error('[Voice Notes] Failed to upload:', error);
      Alert.alert('შეცდომა', 'ხმოვანი ჩანაწერის შენახვა ვერ მოხერხდა');
    } finally {
      setSavingVoiceNote(false);
    }
  };

  const playVoiceNote = async (url: string) => {
    try {
      // Stop any currently playing sound
      if (soundObject) {
        await soundObject.unloadAsync();
        setSoundObject(null);
        setPlayingVoiceNote(null);
      }

      console.log('[Voice Notes] Playing:', url);
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true }
      );

      setSoundObject(sound);
      setPlayingVoiceNote(url);

      // Listen for playback status
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingVoiceNote(null);
          setSoundObject(null);
        }
      });
    } catch (error) {
      console.error('[Voice Notes] Failed to play:', error);
      Alert.alert('შეცდომა', 'ხმოვანი ჩანაწერის დაკვრა ვერ მოხერხდა');
    }
  };

  const stopPlayingVoiceNote = async () => {
    try {
      if (soundObject) {
        await soundObject.stopAsync();
        await soundObject.unloadAsync();
        setSoundObject(null);
        setPlayingVoiceNote(null);
      }
    } catch (error) {
      console.error('[Voice Notes] Failed to stop playback:', error);
    }
  };

  const deleteVoiceNote = async (noteIndex: number) => {
    Alert.alert(
      'ხმოვანი ჩანაწერის წაშლა',
      'ნამდვილად გსურთ ამ ჩანაწერის წაშლა?',
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: 'წაშლა',
          style: 'destructive',
          onPress: async () => {
            try {
              const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
              const updatedVoiceNotes = voiceNotes.filter((_, index) => index !== noteIndex);

              const updateData = {
                voiceNotes: updatedVoiceNotes,
              };

              // Update CPanel
              if (cpanelId) {
                const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
                await updateInvoiceToCPanel(cpanelId, updateData);
              }

              // Update Firebase
              if (!isCpanelOnly) {
                const { updateInspection } = require('../../src/services/firebase');
                await updateInspection(id as string, updateData, cpanelId || undefined);
              }

              setVoiceNotes(updatedVoiceNotes);
              Alert.alert('✅ წარმატება', 'ხმოვანი ჩანაწერი წაიშალა');
            } catch (error) {
              console.error('[Voice Notes] Failed to delete:', error);
              Alert.alert('შეცდომა', 'წაშლა ვერ მოხერხდა');
            }
          },
        },
      ]
    );
  };

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (soundObject) {
        soundObject.unloadAsync();
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [soundObject]);

  // Payment functions
  const loadPayments = async (cpanelId: string) => {
    try {
      setLoadingPayments(true);
      const { fetchPaymentsFromCPanel } = require('../../src/services/cpanelService');
      const result = await fetchPaymentsFromCPanel(cpanelId);

      if (result.success) {
        setPayments(result.payments || []);
        setTotalPaid(result.totalPaid || 0);
        console.log('[Case Detail] Loaded', result.payments?.length || 0, 'payments, total paid:', result.totalPaid);
      }
    } catch (error) {
      console.error('[Case Detail] Error loading payments:', error);
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleAddPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      Alert.alert('შეცდომა', 'გთხოვთ შეიყვანოთ თანხა');
      return;
    }

    try {
      setSavingPayment(true);
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());

      if (!cpanelId) {
        Alert.alert('შეცდომა', 'ინვოისი არ არის სინქრონიზებული CPanel-თან');
        return;
      }

      const paymentData = {
        transferId: parseInt(cpanelId),
        amount: amount,
        paymentMethod: paymentMethod,
        method: paymentMethod === 'Transfer' ? transferMethod : paymentMethod,
        reference: paymentReference,
        notes: paymentNotes,
        paymentDate: new Date().toISOString(),
        recordedBy: 'მობილური აპი',
        currency: 'GEL',
      };

      console.log('[Case Detail] Creating payment:', paymentData);

      const { createPaymentInCPanel } = require('../../src/services/cpanelService');
      const result = await createPaymentInCPanel(paymentData);

      if (result.success) {
        // Reload payments to get fresh data
        await loadPayments(cpanelId);

        // Reset form
        setPaymentAmount('');
        setPaymentMethod('Cash');
        setTransferMethod('BOG');
        setPaymentReference('');
        setPaymentNotes('');
        setShowAddPaymentModal(false);

        Alert.alert('✅ წარმატება', 'გადახდა დაემატა');
      } else {
        Alert.alert('❌ შეცდომა', result.error || 'გადახდის დამატება ვერ მოხერხდა');
      }
    } catch (error) {
      console.error('[Case Detail] Error adding payment:', error);
      Alert.alert('❌ შეცდომა', 'გადახდის დამატება ვერ მოხერხდა');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    Alert.alert(
      'გადახდის წაშლა',
      'ნამდვილად გსურთ ამ გადახდის წაშლა?',
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: 'წაშლა',
          style: 'destructive',
          onPress: async () => {
            try {
              const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());

              const { deletePaymentFromCPanel } = require('../../src/services/cpanelService');
              const result = await deletePaymentFromCPanel(paymentId);

              if (result.success) {
                // Reload payments
                if (cpanelId) {
                  await loadPayments(cpanelId);
                }
                Alert.alert('✅ წარმატება', 'გადახდა წაიშალა');
              } else {
                Alert.alert('❌ შეცდომა', result.error || 'გადახდის წაშლა ვერ მოხერხდა');
              }
            } catch (error) {
              console.error('[Case Detail] Error deleting payment:', error);
              Alert.alert('❌ შეცდომა', 'გადახდის წაშლა ვერ მოხერხდა');
            }
          },
        },
      ]
    );
  };

  const formatPaymentDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    } catch {
      return dateString;
    }
  };

  const getPaymentMethodLabel = (method: string, subMethod?: string): string => {
    if (method === 'Cash') return 'ნაღდი';
    if (method === 'Transfer') {
      if (subMethod === 'BOG') return 'გადარიცხვა (BOG)';
      if (subMethod === 'TBC') return 'გადარიცხვა (TBC)';
      return 'გადარიცხვა';
    }
    if (method === 'BOG') return 'გადარიცხვა (BOG)';
    if (method === 'TBC') return 'გადარიცხვა (TBC)';
    return method;
  };

  const getPaymentMethodIcon = (method: string): string => {
    if (method === 'Cash') return 'cash';
    return 'bank-transfer';
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

    // Get base price
    const basePrice = service.price || service.hourly_rate || service.rate || 0;

    // Check if service has individual discount applied (from CPanel)
    // Use discountedPrice if available, otherwise calculate from discount_percent
    let finalPrice = basePrice;
    if (service.discountedPrice !== undefined && service.discountedPrice !== null) {
      // CPanel provides pre-calculated discounted price
      finalPrice = service.discountedPrice;
    } else if (service.discount_percent && service.discount_percent > 0) {
      // Calculate discount if only percentage is provided
      finalPrice = basePrice * (1 - service.discount_percent / 100);
    }

    return {
      serviceName: finalName,
      serviceNameKa: finalName,
      serviceNameEn: englishName,
      description: service.description || '',
      price: finalPrice, // Use discounted price if available
      basePrice: basePrice, // Keep original price for reference
      discount_percent: service.discount_percent || 0,
      discountedPrice: service.discountedPrice,
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
      // Price from CPanel is already the total price (unit_rate * count)
      // Do NOT multiply by count again - that causes double multiplication
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
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
      console.log('[Case Detail] Saving discounts with cPanel ID:', cpanelId, 'isCpanelOnly:', isCpanelOnly);

      const discountData = {
        services_discount_percent: parseFloat(servicesDiscount) || 0,
        parts_discount_percent: parseFloat(partsDiscount) || 0,
        global_discount_percent: parseFloat(globalDiscount) || 0,
        totalPrice: getGrandTotal(),
      };

      // Update CPanel first if we have cpanel ID
      if (cpanelId) {
        const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
        const cpanelResult = await updateInvoiceToCPanel(cpanelId, discountData);
        console.log('[Case Detail] CPanel discount update result:', cpanelResult);
      }

      // Only update Firebase if this is NOT a CPanel-only case
      if (!isCpanelOnly) {
        const { updateInspection } = require('../../src/services/firebase');
        await updateInspection(id as string, discountData, cpanelId || undefined);
      }

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
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
      console.log('[Case Detail] Toggling VAT with cPanel ID:', cpanelId, 'isCpanelOnly:', isCpanelOnly);

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

      // Update CPanel first if we have cpanel ID
      if (cpanelId) {
        const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
        const cpanelResult = await updateInvoiceToCPanel(cpanelId, vatData);
        console.log('[Case Detail] CPanel VAT update result:', cpanelResult);
      }

      // Only update Firebase if this is NOT a CPanel-only case
      if (!isCpanelOnly) {
        const { updateInspection } = require('../../src/services/firebase');
        await updateInspection(id as string, vatData, cpanelId || undefined);
      }

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
        nachrebi_qty: cpanelData.nachrebi_qty ?? caseData.nachrebi_qty ?? null,
        totalPrice: cpanelData.totalPrice || caseData.totalPrice,
        status: cpanelData.status || caseData.status,
        repair_status: cpanelData.repair_status ?? caseData.repair_status ?? null,
        services: cpanelData.services || caseData.services,
        parts: cpanelData.parts || caseData.parts,
        // Sync discount fields from cPanel
        services_discount_percent: cpanelData.services_discount_percent ?? caseData.services_discount_percent ?? 0,
        parts_discount_percent: cpanelData.parts_discount_percent ?? caseData.parts_discount_percent ?? 0,
        global_discount_percent: cpanelData.global_discount_percent ?? caseData.global_discount_percent ?? 0,
        // Sync internal notes from cPanel
        internalNotes: cpanelData.internalNotes || caseData.internalNotes || [],
      };

      // Only update Firebase if this is NOT a CPanel-only case
      if (!isCpanelOnly) {
        const { updateInspection } = require('../../src/services/firebase');
        await updateInspection(id as string, {
          customerName: updatedData.customerName,
          customerPhone: updatedData.customerPhone,
          carMake: updatedData.carMake,
          carModel: updatedData.carModel,
          plate: updatedData.plate,
          nachrebi_qty: updatedData.nachrebi_qty,
          totalPrice: updatedData.totalPrice,
          status: updatedData.status,
          repair_status: updatedData.repair_status,
          services: updatedData.services,
          parts: updatedData.parts,
          // Save discount fields to Firebase
          services_discount_percent: updatedData.services_discount_percent,
          parts_discount_percent: updatedData.parts_discount_percent,
          global_discount_percent: updatedData.global_discount_percent,
          // Save internal notes to Firebase
          internalNotes: updatedData.internalNotes,
        });
      }

      setCaseData(updatedData);
      setEditedServices(updatedData.services || []);
      setCaseParts(updatedData.parts || []);
      setEditedCustomerName(updatedData.customerName || '');
      setEditedCustomerPhone(updatedData.customerPhone || '');
      setEditedCarMake(updatedData.carMake || '');
      setEditedCarModel(updatedData.carModel || '');
      setEditedPlate(updatedData.plate || '');
      setNachrebiQty(String(updatedData.nachrebi_qty || ''));
      // Update discount state
      setServicesDiscount(String(updatedData.services_discount_percent || 0));
      setPartsDiscount(String(updatedData.parts_discount_percent || 0));
      setGlobalDiscount(String(updatedData.global_discount_percent || 0));
      // Update workflow status state
      setRepairStatus(updatedData.repair_status);
      setCaseStatus(updatedData.status);
      // Update internal notes state
      setInternalNotes(updatedData.internalNotes || []);

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

      // Check if cPanel has different internal notes
      const cpanelNotes = cpanelData.internalNotes || [];
      const currentNotes = currentData.internalNotes || [];
      const hasInternalNotesChanges = JSON.stringify(cpanelNotes) !== JSON.stringify(currentNotes);

      // Check if cPanel has different parts
      const cpanelParts = cpanelData.parts || [];
      const currentParts = currentData.inventoryParts || currentData.parts || [];
      const hasPartsChanges = JSON.stringify(cpanelParts) !== JSON.stringify(currentParts) ||
        cpanelParts.length !== currentParts.length;

      // Check if cPanel has different case type
      const hasCaseTypeChanges = cpanelData.caseType !== (currentData.caseType || null);

      // Check if cPanel has different assigned mechanic
      const cpanelMechanic = cpanelData.assigned_mechanic || cpanelData.assignedMechanic || null;
      const currentMechanic = currentData.assignedMechanic || currentData.assigned_mechanic || null;
      const hasMechanicChanges = cpanelMechanic !== currentMechanic;

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

      if (hasGlobalDiscountChanges || hasServiceDiscountChanges || hasVATChanges || hasWorkflowStatusChanges || hasInternalNotesChanges || hasPartsChanges || hasCaseTypeChanges || hasMechanicChanges) {
        console.log('[Case Detail] Silent sync: Changes detected');
        if (hasInternalNotesChanges) {
          console.log('[Case Detail] Silent sync: Internal notes changed, syncing from CPanel');
        }
        if (hasPartsChanges) {
          console.log('[Case Detail] Silent sync: Parts changed, syncing from CPanel. CPanel:', cpanelParts.length, 'Local:', currentParts.length);
        }
        if (hasCaseTypeChanges) {
          console.log('[Case Detail] Silent sync: Case type changed, syncing from CPanel:', cpanelData.caseType);
        }
        if (hasMechanicChanges) {
          console.log('[Case Detail] Silent sync: Assigned mechanic changed, syncing from CPanel:', cpanelMechanic);
        }

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

        // Transform cPanel parts to match Firebase structure
        const transformedParts = cpanelParts.map((part: any) => ({
          id: part.id || `part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          nameKa: part.name || part.nameKa || '',
          name: part.name_en || part.name || part.nameKa || '',
          partNumber: part.part_number || part.partNumber || '',
          unitPrice: parseFloat(part.unit_price || part.unitPrice) || 0,
          quantity: parseInt(part.quantity) || 1,
          totalPrice: parseFloat(part.total_price || part.totalPrice) || 0,
          notes: part.notes || '',
        }));

        // Only update Firebase if this is NOT a CPanel-only case
        // CPanel-only cases have numeric IDs and no Firebase document
        if (!isCpanelOnly) {
          console.log('[Case Detail] Silent sync: Updating Firebase document');
          const { updateInspection } = require('../../src/services/firebase');
          await updateInspection(id as string, {
            services: updatedServices,
            inventoryParts: transformedParts,
            parts: transformedParts,
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
            // Internal notes
            internalNotes: cpanelNotes,
            // Case type
            caseType: cpanelData.caseType ?? null,
            // Assigned mechanic
            assignedMechanic: cpanelMechanic,
          });
        } else {
          console.log('[Case Detail] Silent sync: Skipping Firebase update for CPanel-only case');
        }

        // Update local state
        setServicesDiscount(String(cpanelData.services_discount_percent || 0));
        setPartsDiscount(String(cpanelData.parts_discount_percent || 0));
        setGlobalDiscount(String(cpanelData.global_discount_percent || 0));
        setIncludeVAT(cpanelData.includeVAT || false);
        setRepairStatus(cpanelData.repair_status ?? null);
        setCaseStatus(cpanelData.status ?? null);
        // Sync case type from cPanel
        setCaseType(cpanelData.caseType ?? null);
        // Sync assigned mechanic from cPanel
        setAssignedMechanic(cpanelMechanic);
        // Sync internal notes from cPanel
        if (cpanelData.internalNotes && Array.isArray(cpanelData.internalNotes)) {
          setInternalNotes(cpanelData.internalNotes);
        }
        // Sync parts from cPanel
        setCaseParts(transformedParts);
        setCaseData((prev: any) => ({
          ...prev,
          services: updatedServices,
          inventoryParts: transformedParts,
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
          internalNotes: cpanelNotes,
          caseType: cpanelData.caseType ?? null,
          assignedMechanic: cpanelMechanic,
        }));
        setEditedServices(updatedServices);

        console.log('[Case Detail] Silent sync: Data updated from cPanel (including workflow statuses, internal notes, case type, and assigned mechanic)');
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
          console.log('[Case Detail] CPanel data received:', JSON.stringify({
            assigned_mechanic: cpanelData.assigned_mechanic,
            assignedMechanic: cpanelData.assignedMechanic,
            caseType: cpanelData.caseType,
          }));
          
          const mechanicValue = cpanelData.assigned_mechanic || cpanelData.assignedMechanic || null;
          
          const data = {
            id: cpanelData.cpanelId?.toString() || id,
            customerName: cpanelData.customerName || '',
            customerPhone: cpanelData.customerPhone || '',
            carMake: cpanelData.carMake || cpanelData.vehicleMake || '',
            carModel: cpanelData.carModel || cpanelData.vehicleModel || '',
            plate: cpanelData.plate || '',
            nachrebi_qty: cpanelData.nachrebi_qty || null,
            totalPrice: cpanelData.totalPrice || 0,
            repair_status: cpanelData.repair_status || null,
            status: cpanelData.status || 'New',
            repair_status_id: cpanelData.repair_status_id || cpanelData.repairStatusId || null,
            status_id: cpanelData.status_id || cpanelData.statusId || null,
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
            caseType: cpanelData.caseType || null,
            assignedMechanic: mechanicValue,
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
          setNachrebiQty(String(data.nachrebi_qty || ''));
          setServicesDiscount(String(data.services_discount_percent || 0));
          setPartsDiscount(String(data.parts_discount_percent || 0));
          setGlobalDiscount(String(data.global_discount_percent || 0));
          setIncludeVAT(data.includeVAT || false);
          setRepairStatus(data.repair_status);
          setCaseStatus(data.status || null);
          setRepairStatusId(data.repair_status_id);
          setCaseStatusId(data.status_id);
          setCaseType(cpanelData.caseType || null);
          setCpanelInvoiceId(id as string);
          // Load assigned mechanic
          console.log('[Case Detail] Setting assigned mechanic to:', mechanicValue);
          setAssignedMechanic(mechanicValue);
          // Load internal notes
          setInternalNotes(cpanelData.internalNotes || []);
          // Load voice notes
          setVoiceNotes(cpanelData.voiceNotes || []);
          // Load payments
          loadPayments(id as string);
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
        setNachrebiQty(String(data.nachrebi_qty || ''));
        // Load discounts
        setServicesDiscount(String(data.services_discount_percent || 0));
        setPartsDiscount(String(data.parts_discount_percent || 0));
        setGlobalDiscount(String(data.global_discount_percent || 0));
        // Load VAT
        setIncludeVAT(data.includeVAT || false);
        // Load workflow statuses
        setRepairStatus(data.repair_status || null);
        setCaseStatus(data.status || null);
        setRepairStatusId(data.repair_status_id || data.repairStatusId || null);
        setCaseStatusId(data.status_id || data.statusId || null);
        // Load case type
        setCaseType(data.caseType || null);
        // Load assigned mechanic
        setAssignedMechanic(data.assignedMechanic || data.assigned_mechanic || null);
        // Load internal notes
        setInternalNotes(data.internalNotes || []);
        // Load voice notes
        setVoiceNotes(data.voiceNotes || []);
        // Load SMS sent status and recipients
        loadSmsSentStatus();
        loadSmsRecipients();
        if (data.cpanelInvoiceId) {
          setCpanelInvoiceId(data.cpanelInvoiceId);
          console.log('[Case Detail] cPanel invoice ID:', data.cpanelInvoiceId);
          // Background sync from cPanel to get latest data (non-blocking)
          silentSyncFromCPanel(data.cpanelInvoiceId, data);
          // Load payments
          loadPayments(data.cpanelInvoiceId);
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

  // ─── Invoice PDF Generation ───────────────────────────────────────
  const handleGenerateInvoicePdf = async () => {
    if (!caseData) return;
    setGeneratingPdf(true);
    try {
      const pdfData = {
        caseId: (id as string) || '',
        caseType,
        createdAt: caseData.createdAt || caseData.serviceDate || null,
        customerName: caseData.customerName || '',
        customerPhone: caseData.customerPhone || '',
        carMake: caseData.carMake || caseData.vehicleMake || '',
        carModel: caseData.carModel || caseData.vehicleModel || '',
        plate: caseData.plate || '',
        services: caseData.services || [],
        parts: caseParts || [],
        servicesDiscount: parseFloat(servicesDiscount) || 0,
        partsDiscount: parseFloat(partsDiscount) || 0,
        globalDiscount: parseFloat(globalDiscount) || 0,
        includeVAT,
        vatAmount: getVATAmount(),
        vatRate: includeVAT ? 18 : 0,
        totalPrice: getGrandTotal(),
        payments,
        totalPaid,
        insuranceCompany: insuranceCompany || null,
        claimNumber: claimNumber || null,
        adjusterName: adjusterName || null,
        adjusterPhone: adjusterPhone || null,
        assignedMechanic,
      };
      await shareInvoicePdf(pdfData);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      Alert.alert('❌ შეცდომა', 'ინვოისის PDF-ის გენერაცია ვერ მოხერხდა');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ─── Insurance Fields Save ────────────────────────────────────────
  const handleSaveInsuranceInfo = async () => {
    try {
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());

      const updateData = {
        insuranceCompany: insuranceCompany.trim(),
        claimNumber: claimNumber.trim(),
        adjusterName: adjusterName.trim(),
        adjusterPhone: adjusterPhone.trim(),
      };

      if (cpanelId) {
        const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
        await updateInvoiceToCPanel(cpanelId, updateData);
      }

      if (!isCpanelOnly) {
        const { updateInspection } = require('../../src/services/firebase');
        await updateInspection(id as string, updateData, cpanelId || undefined);
      }

      setCaseData({ ...caseData, ...updateData });
      setShowInsuranceModal(false);
      Alert.alert('✅', 'სადაზღვევო ინფორმაცია შენახულია');
    } catch (error) {
      console.error('Error saving insurance info:', error);
      Alert.alert('❌ შეცდომა', 'შენახვა ვერ მოხერხდა');
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
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
      console.log('[Case Detail] Updating status with cPanel ID:', cpanelId, 'isCpanelOnly:', isCpanelOnly);

      // Update CPanel first if we have cpanel ID
      if (cpanelId) {
        const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
        const cpanelResult = await updateInvoiceToCPanel(cpanelId, { status: newStatus });
        console.log('[Case Detail] CPanel status update result:', cpanelResult);
      }

      // Only update Firebase if this is NOT a CPanel-only case
      if (!isCpanelOnly) {
        const { updateInspection } = require('../../src/services/firebase');
        await updateInspection(id as string, { status: newStatus }, cpanelId || undefined);
      }

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
      const newTotal = editedServices.reduce((sum, s) => sum + (normalizeService(s).price || s.price || 0), 0);
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
      console.log('[Case Detail] Saving with cPanel ID:', cpanelId, 'isCpanelOnly:', isCpanelOnly);

      const updateData = {
        services: editedServices,
        totalPrice: newTotal
      };

      // Update CPanel first if we have cpanel ID
      if (cpanelId) {
        const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
        const cpanelResult = await updateInvoiceToCPanel(cpanelId, updateData);
        console.log('[Case Detail] CPanel changes update result:', cpanelResult);
      }

      // Only update Firebase if this is NOT a CPanel-only case
      if (!isCpanelOnly) {
        const { updateInspection } = require('../../src/services/firebase');
        await updateInspection(id as string, updateData, cpanelId || undefined);
      }

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
    const newCountNum = parseFloat(newCount) || 1; // Changed from parseInt to parseFloat to support decimals

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
    // Use basePrice (original price before discount) instead of price (after discount)
    const basePrice = normalized.basePrice || normalized.price;
    // If unitPrice was stored, use it; otherwise calculate from total / count
    const unitPrice = service.unitPrice || (basePrice / (normalized.count || 1));
    setEditServicePrice(unitPrice.toString()); // Store UNIT price, not total
    setEditServiceCount(normalized.count.toString());
    setEditServiceDiscount((service.discount_percent || 0).toString());
    // Store the base unit price for reference
    setEditServiceBaseUnitPrice(unitPrice);
    setShowEditServiceModal(true);
  };

  const handleEditServiceCountChange = (newCount: string) => {
    // Only update the count, do NOT change the unit price
    // The total will be calculated in the preview and when saving
    setEditServiceCount(newCount);

    console.log(`[Edit Modal] Quantity changed to ${newCount}, Unit price stays at ${editServicePrice}`);
  };

  const handleEditServicePriceChange = (newPrice: string) => {
    // This is the unit price - store it directly
    setEditServicePrice(newPrice);
    setEditServiceBaseUnitPrice(parseFloat(newPrice) || 0);

    console.log(`[Edit Modal] Unit price changed to ${newPrice}`);
  };

  const handleSaveEditedService = async () => {
    if (!editServiceName.trim() || !editServicePrice.trim()) {
      Alert.alert('⚠️ Validation Error', 'Service name and price are required');
      return;
    }

    if (editingServiceIndex === null) return;

    try {
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
      console.log('[Case Detail] Saving edited service with cPanel ID:', cpanelId, 'isCpanelOnly:', isCpanelOnly);

      const serviceDiscountPercent = parseFloat(editServiceDiscount) || 0;
      const unitPrice = parseFloat(editServicePrice) || 0;
      const serviceCount = parseFloat(editServiceCount) || 1;
      // Calculate total price: unit price × count
      const serviceBasePrice = unitPrice * serviceCount;
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
        price: serviceBasePrice, // Total price (unit × count)
        unitPrice: unitPrice, // Store unit price for future edits
        discountedPrice: serviceDiscountedPrice,
        discount_percent: serviceDiscountPercent,
        count: serviceCount,
      };
      
      console.log('[Case Detail] Saving service - FULL SERVICE OBJECT:', JSON.stringify(updatedServices[editingServiceIndex], null, 2));
      console.log('[Case Detail] ALL SERVICES TO SAVE:', JSON.stringify(updatedServices, null, 2));

      // Calculate new total with individual service discounts and global discounts
      // Note: normalizeService() already applies individual discounts, so we just use the price
      const servicesSubtotal = updatedServices.reduce((sum, s) => {
        const sPrice = normalizeService(s).price || s.price || 0;
        return sum + sPrice;
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

      const updateData = {
        services: updatedServices,
        totalPrice: newTotal,
      };

      // Update CPanel first if we have cpanel ID
      if (cpanelId) {
        const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
        const cpanelResult = await updateInvoiceToCPanel(cpanelId, updateData);
        console.log('[Case Detail] CPanel edited service update result:', cpanelResult);
      }

      // Only update Firebase if this is NOT a CPanel-only case
      if (!isCpanelOnly) {
        const { updateInspection } = require('../../src/services/firebase');
        await updateInspection(id as string, updateData, cpanelId || undefined);
      }

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
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
      console.log('[Case Detail] Saving customer info with cPanel ID:', cpanelId, 'isCpanelOnly:', isCpanelOnly);

      const updateData = {
        customerName: editedCustomerName,
        customerPhone: editedCustomerPhone,
        carMake: editedCarMake,
        carModel: editedCarModel,
        carMakeId: editedCarMakeId,
        carModelId: editedCarModelId,
        plate: editedPlate
      };

      // Update CPanel first if we have cpanel ID
      if (cpanelId) {
        const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
        const cpanelResult = await updateInvoiceToCPanel(cpanelId, updateData);
        console.log('[Case Detail] CPanel customer update result:', cpanelResult);
      }

      // Only update Firebase if this is NOT a CPanel-only case
      if (!isCpanelOnly) {
        const { updateInspection } = require('../../src/services/firebase');
        await updateInspection(id as string, updateData, cpanelId || undefined);
      }

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
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
      console.log('[Case Detail] Adding service with cPanel ID:', cpanelId, 'isCpanelOnly:', isCpanelOnly);

      // Use Georgian name as primary, English as backup
      const georgianName = selectedService?.nameKa || getServiceNameGeorgian(newServiceName) || newServiceName;
      
      const newService = {
        serviceName: georgianName, // Store Georgian as primary name
        serviceNameKa: georgianName,
        name: georgianName, // For PHP compatibility
        nameKa: georgianName, // Backup field
        serviceNameEn: selectedService?.nameEn || newServiceName, // Store English as backup
        price: parseFloat(newServicePrice) || 0,
        count: parseFloat(newServiceCount) || 1, // Changed from parseInt to parseFloat to support decimals
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

      // Update CPanel first if we have cpanel ID
      if (cpanelId) {
        const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
        const cpanelResult = await updateInvoiceToCPanel(cpanelId, {
          services: updatedServices,
          totalPrice: newTotal,
        });
        console.log('[Case Detail] CPanel service add result:', cpanelResult);
      }

      // Only update Firebase if this is NOT a CPanel-only case
      if (!isCpanelOnly) {
        const { updateInspection } = require('../../src/services/firebase');
        await updateInspection(id as string, {
          services: updatedServices,
          totalPrice: newTotal,
        }, cpanelId || undefined);
      }

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

  const handleAddPart = async () => {
    if (!newPartNameInput.trim() || !newPartPrice.trim()) {
      Alert.alert('⚠️ შეცდომა', 'ნაწილის სახელი და ფასი აუცილებელია');
      return;
    }

    try {
      const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
      console.log('[Case Detail] Adding part with cPanel ID:', cpanelId);

      const unitPrice = parseFloat(newPartPrice) || 0;
      const quantity = parseFloat(newPartQuantity) || 1; // Changed from parseInt to parseFloat to support decimals

      const newPart = {
        id: `part_${Date.now()}`,
        nameKa: newPartNameInput.trim(),
        name: newPartNameInput.trim(),
        partNumber: newPartNumberInput.trim() || '',
        unitPrice: unitPrice,
        quantity: quantity,
        totalPrice: unitPrice * quantity,
        notes: newPartNotes.trim() || '',
      };

      console.log('[Case Detail] New part object:', newPart);

      // Add to existing parts
      const currentParts = caseParts || [];
      const updatedParts = [...currentParts, newPart];

      // Calculate new total including parts
      const servicesTotal = (caseData.services || []).reduce((sum: number, s: any) => {
        const normalized = normalizeService(s);
        return sum + (normalized.price || s.price || 0);
      }, 0);
      const partsTotal = updatedParts.reduce((sum: number, p: any) =>
        sum + (p.totalPrice || (p.unitPrice * (p.quantity || 1)) || 0), 0);
      const newTotal = servicesTotal + partsTotal;

      // Update Firebase (only if not cPanel-only)
      if (!isCpanelOnly) {
        const { updateInspection } = require('../../src/services/firebase');
        // Send both inventoryParts (for Firebase) and parts (for cPanel sync)
        await updateInspection(id as string, {
          inventoryParts: updatedParts,
          parts: updatedParts, // cPanel expects 'parts' field
          totalPrice: newTotal,
        }, cpanelId || undefined);
      } else if (cpanelId) {
        // For cPanel-only cases, update cPanel directly
        const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
        await updateInvoiceToCPanel(cpanelId, {
          parts: updatedParts,
          totalPrice: newTotal,
        });
      }

      // Update local state
      setCaseParts(updatedParts);
      setCaseData({ ...caseData, inventoryParts: updatedParts, totalPrice: newTotal });

      // Reset form and close modal
      setShowAddPartModal(false);
      setNewPartNameInput('');
      setNewPartNumberInput('');
      setNewPartPrice('');
      setNewPartQuantity('1');
      setNewPartNotes('');

      Alert.alert('✅ წარმატება', 'ნაწილი დაემატა');
    } catch (error) {
      console.error('Error adding part:', error);
      Alert.alert('❌ შეცდომა', 'ნაწილის დამატება ვერ მოხერხდა');
    }
  };

  const handleDeletePart = async (partIndex: number) => {
    Alert.alert(
      '🗑️ ნაწილის წაშლა',
      'დარწმუნებული ხართ რომ გსურთ ამ ნაწილის წაშლა?',
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: 'წაშლა',
          style: 'destructive',
          onPress: async () => {
            try {
              const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
              
              // Remove part from array
              const updatedParts = caseParts.filter((_, index) => index !== partIndex);
              
              // Calculate new total
              const servicesTotal = (caseData.services || []).reduce((sum: number, s: any) => {
                const normalized = normalizeService(s);
                return sum + (normalized.price || s.price || 0);
              }, 0);
              const partsTotal = updatedParts.reduce((sum: number, p: any) =>
                sum + (p.totalPrice || (p.unitPrice * (p.quantity || 1)) || 0), 0);
              const newTotal = servicesTotal + partsTotal;

              // Update Firebase (only if not cPanel-only)
              if (!isCpanelOnly) {
                const { updateInspection } = require('../../src/services/firebase');
                await updateInspection(id as string, {
                  inventoryParts: updatedParts,
                  parts: updatedParts,
                  totalPrice: newTotal,
                }, cpanelId || undefined);
              } else if (cpanelId) {
                // For cPanel-only cases, update cPanel directly
                const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
                await updateInvoiceToCPanel(cpanelId, {
                  parts: updatedParts,
                  totalPrice: newTotal,
                });
              }

              // Update local state
              setCaseParts(updatedParts);
              setCaseData({ ...caseData, inventoryParts: updatedParts, totalPrice: newTotal });

              Alert.alert('✅ წარმატება', 'ნაწილი წაიშალა');
            } catch (error) {
              console.error('Error deleting part:', error);
              Alert.alert('❌ შეცდომა', 'ნაწილის წაშლა ვერ მოხერხდა');
            }
          },
        },
      ]
    );
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

        // Use cpanel ID for storage path to keep photos organized
        const storageId = isCpanelOnly ? `cpanel_${id}` : (id as string);

        // 3. Upload the photo to Firebase Storage
        const newImages = result.assets.map(asset => ({ uri: asset.uri, label: 'Camera Photo' }));
        const uploadedPhotos = await uploadMultipleImages(newImages, storageId);

        // 4. Combine with existing photos
        const existingPhotos = caseData.photos || [];
        const updatedPhotos = [...existingPhotos, ...uploadedPhotos];

        // 5. Persist photos
        if (isCpanelOnly) {
          // For cPanel-only cases, sync photo URLs to cPanel MySQL
          const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
          await updateInvoiceToCPanel(id as string, { photos: updatedPhotos });
        } else {
          // For Firebase cases, update Firestore (and cPanel via updateInspection)
          const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
          await updateInspection(id as string, { photos: updatedPhotos }, cpanelId || undefined);
        }

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

        // Use cpanel ID for storage path to keep photos organized
        const storageId = isCpanelOnly ? `cpanel_${id}` : (id as string);

        // 3. Upload new images to Firebase Storage
        const newImages = result.assets.map(asset => ({ uri: asset.uri, label: 'Gallery Photo' }));
        const uploadedPhotos = await uploadMultipleImages(newImages, storageId);

        // 4. Combine with existing photos
        const existingPhotos = caseData.photos || [];
        const updatedPhotos = [...existingPhotos, ...uploadedPhotos];

        // 5. Persist photos
        if (isCpanelOnly) {
          // For cPanel-only cases, sync photo URLs to cPanel MySQL
          const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
          await updateInvoiceToCPanel(id as string, { photos: updatedPhotos });
        } else {
          // For Firebase cases, update Firestore (and cPanel via updateInspection)
          const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
          await updateInspection(id as string, { photos: updatedPhotos }, cpanelId || undefined);
        }

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

              // Persist the change
              if (isCpanelOnly) {
                // For cPanel-only cases, sync to cPanel MySQL
                const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
                await updateInvoiceToCPanel(id as string, { photos: updatedPhotos });
              } else {
                // For Firebase cases, update Firestore (and cPanel via updateInspection)
                const cpanelId = cpanelInvoiceId || (await getCPanelInvoiceId());
                await updateInspection(id as string, { photos: updatedPhotos }, cpanelId || undefined);
              }

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
      
      // Update CPanel first if we have cpanel ID
      if (cpanelId) {
        const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
        await updateInvoiceToCPanel(cpanelId, { parts: updatedParts });
      }

      // Only update Firebase if this is NOT a CPanel-only case
      if (!isCpanelOnly) {
        const { updateInspection } = require('../../src/services/firebase');
        await updateInspection(id as string, { parts: updatedParts }, cpanelId || undefined);
      }

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
    : getGrandTotal();

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
              onPress={handleRefresh}
              disabled={isRefreshing}
              style={[styles.shareButton, isRefreshing && styles.syncButtonDisabled]}
            >
              <MaterialCommunityIcons
                name={isRefreshing ? "loading" : "refresh"}
                size={20}
                color={isRefreshing ? COLORS.text.disabled : COLORS.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSmsSettingsVisible(true)}
              style={styles.shareButton}
            >
              <MaterialCommunityIcons
                name="message-cog"
                size={20}
                color={COLORS.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSendCompletionSMS}
              disabled={sendingSms}
              style={[styles.shareButton, sendingSms && styles.syncButtonDisabled]}
            >
              <MaterialCommunityIcons
                name={smsSent ? "message-check" : "message-text"}
                size={20}
                color={sendingSms ? COLORS.text.disabled : smsSent ? '#10B981' : COLORS.primary}
              />
              {smsSent && (
                <View style={styles.smsSentBadge}>
                  <MaterialCommunityIcons name="check" size={10} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
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

                  {/* Case Status */}
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

                  {/* Case Type */}
                  <TouchableOpacity
                    style={styles.workflowStatusRow}
                    onPress={() => setShowCaseTypeModal(true)}
                  >
                    <View style={styles.workflowStatusLabel}>
                      <MaterialCommunityIcons name={getCaseTypeIcon(caseType) as any} size={16} color={COLORS.text.secondary} />
                      <Text style={styles.workflowLabelText}>საქმის ტიპი</Text>
                    </View>
                    <View style={[
                      styles.workflowStatusBadge,
                      { backgroundColor: getCaseTypeColor(caseType) + '15' }
                    ]}>
                      <Text style={[
                        styles.workflowStatusText,
                        { color: getCaseTypeColor(caseType) }
                      ]}>
                        {getCaseTypeLabel(caseType)}
                      </Text>
                      <MaterialCommunityIcons name="chevron-right" size={16} color={getCaseTypeColor(caseType)} />
                    </View>
                  </TouchableOpacity>

                  {/* Assigned Mechanic */}
                  <TouchableOpacity
                    style={styles.workflowStatusRow}
                    onPress={handleOpenMechanicModal}
                  >
                    <View style={[styles.workflowStatusLabel, { flex: 1, marginRight: 8 }]}>
                      <MaterialCommunityIcons name="account-wrench" size={16} color={COLORS.text.secondary} />
                      <Text style={styles.workflowLabelText} numberOfLines={1}>მინიჭებული მექანიკოსი</Text>
                    </View>
                    <View style={[
                      styles.workflowStatusBadge,
                      { backgroundColor: assignedMechanic ? '#6366F1' + '15' : '#94A3B8' + '15', maxWidth: '50%' }
                    ]}>
                      <Text
                        style={[
                          styles.workflowStatusText,
                          { color: assignedMechanic ? '#6366F1' : '#94A3B8', flex: 1 }
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {assignedMechanic || 'არ არის მინიჭებული'}
                      </Text>
                      <MaterialCommunityIcons name="chevron-right" size={16} color={assignedMechanic ? '#6366F1' : '#94A3B8'} style={{ flexShrink: 0 }} />
                    </View>
                  </TouchableOpacity>

                  {/* Nachrebi Qty (Pieces Quantity) */}
                  <TouchableOpacity
                    style={styles.workflowStatusRow}
                    onPress={handleOpenNachrebiQtyModal}
                  >
                    <View style={[styles.workflowStatusLabel, { flex: 1, marginRight: 8 }]}>
                      <MaterialCommunityIcons name="package-variant" size={16} color={COLORS.text.secondary} />
                      <Text style={styles.workflowLabelText} numberOfLines={1}>ნაჭრების რაოდენობა</Text>
                    </View>
                    <View style={[
                      styles.workflowStatusBadge,
                      { backgroundColor: (nachrebiQty && nachrebiQty !== '' && nachrebiQty !== '0') ? '#10B981' + '15' : '#94A3B8' + '15', maxWidth: '50%' }
                    ]}>
                      <Text
                        style={[
                          styles.workflowStatusText,
                          { color: (nachrebiQty && nachrebiQty !== '' && nachrebiQty !== '0') ? '#10B981' : '#94A3B8', flex: 1 }
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {(nachrebiQty && nachrebiQty !== '' && nachrebiQty !== '0') ? `${nachrebiQty} ცალი` : 'არ არის მითითებული'}
                      </Text>
                      <MaterialCommunityIcons name="chevron-right" size={16} color={(nachrebiQty && nachrebiQty !== '' && nachrebiQty !== '0') ? '#10B981' : '#94A3B8'} style={{ flexShrink: 0 }} />
                    </View>
                  </TouchableOpacity>
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

          {/* Voice Notes Card */}
          <Card style={styles.modernCard}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#8B5CF615' }]}>
                    <MaterialCommunityIcons name="microphone" size={20} color="#8B5CF6" />
                  </View>
                  <Text style={styles.cardTitle}>ხმოვანი ჩანაწერები ({voiceNotes.length})</Text>
                </View>
                {!isRecordingVoice && !savingVoiceNote && (
                  <TouchableOpacity
                    onPress={startVoiceRecording}
                    style={styles.editIconButton}
                  >
                    <MaterialCommunityIcons name="microphone-plus" size={28} color="#8B5CF6" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Recording UI */}
              {isRecordingVoice && (
                <View style={styles.recordingContainer}>
                  <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>ჩაწერა... {formatDuration(recordingDuration)}</Text>
                  </View>
                  <View style={styles.recordingActions}>
                    <TouchableOpacity
                      onPress={cancelVoiceRecording}
                      style={[styles.recordingButton, styles.cancelRecordingButton]}
                    >
                      <MaterialCommunityIcons name="close" size={24} color="#EF4444" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={stopVoiceRecording}
                      style={[styles.recordingButton, styles.stopRecordingButton]}
                    >
                      <MaterialCommunityIcons name="stop" size={24} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Saving indicator */}
              {savingVoiceNote && (
                <View style={styles.savingVoiceNoteContainer}>
                  <ActivityIndicator size="small" color="#8B5CF6" />
                  <Text style={styles.savingVoiceNoteText}>ინახება...</Text>
                </View>
              )}

              {/* Voice Notes List */}
              {!isRecordingVoice && !savingVoiceNote && voiceNotes.length === 0 ? (
                <View style={styles.emptyNotesContainer}>
                  <MaterialCommunityIcons name="microphone-off" size={40} color={COLORS.text.disabled} />
                  <Text style={styles.emptyNotesText}>ხმოვანი ჩანაწერები არ არის</Text>
                  <TouchableOpacity
                    onPress={startVoiceRecording}
                    style={[styles.addNoteButton, { borderColor: '#8B5CF6' }]}
                  >
                    <MaterialCommunityIcons name="microphone" size={18} color="#8B5CF6" />
                    <Text style={[styles.addNoteButtonText, { color: '#8B5CF6' }]}>ჩაწერის დაწყება</Text>
                  </TouchableOpacity>
                </View>
              ) : !isRecordingVoice && !savingVoiceNote && (
                <View style={styles.voiceNotesList}>
                  {voiceNotes.map((note, index) => (
                    <View key={index} style={styles.voiceNoteItem}>
                      <View style={styles.voiceNoteInfo}>
                        <View style={styles.voiceNoteHeader}>
                          <MaterialCommunityIcons name="account-voice" size={18} color="#8B5CF6" />
                          <Text style={styles.voiceNoteAuthor}>{note.authorName}</Text>
                          {note.duration !== undefined && (
                            <Text style={styles.voiceNoteDuration}>{formatDuration(note.duration)}</Text>
                          )}
                        </View>
                        <Text style={styles.voiceNoteDate}>{formatNoteDate(note.timestamp)}</Text>
                      </View>
                      <View style={styles.voiceNoteActions}>
                        <TouchableOpacity
                          onPress={() => playingVoiceNote === note.url ? stopPlayingVoiceNote() : playVoiceNote(note.url)}
                          style={[styles.voiceNotePlayButton, playingVoiceNote === note.url && styles.voiceNotePlayingButton]}
                        >
                          <MaterialCommunityIcons 
                            name={playingVoiceNote === note.url ? "stop" : "play"} 
                            size={22} 
                            color={playingVoiceNote === note.url ? "white" : "#8B5CF6"} 
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => deleteVoiceNote(index)}
                          style={styles.voiceNoteDeleteButton}
                        >
                          <MaterialCommunityIcons name="delete-outline" size={20} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                      {index < voiceNotes.length - 1 && <Divider style={styles.noteDivider} />}
                    </View>
                  ))}
                </View>
              )}
            </Card.Content>
          </Card>

          {/* Payments Card */}
          <Card style={styles.modernCard}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#10B98115' }]}>
                    <MaterialCommunityIcons name="cash-multiple" size={20} color="#10B981" />
                  </View>
                  <Text style={styles.cardTitle}>გადახდები ({payments.length})</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowAddPaymentModal(true)}
                  style={styles.editIconButton}
                >
                  <MaterialCommunityIcons name="plus-circle" size={28} color="#10B981" />
                </TouchableOpacity>
              </View>

              {/* Payment Summary */}
              <View style={styles.paymentSummary}>
                <View style={styles.paymentSummaryRow}>
                  <Text style={styles.paymentSummaryLabel}>სულ თანხა:</Text>
                  <Text style={styles.paymentSummaryValue}>₾{getGrandTotal().toFixed(2)}</Text>
                </View>
                <View style={styles.paymentSummaryRow}>
                  <Text style={styles.paymentSummaryLabel}>გადახდილი:</Text>
                  <Text style={[styles.paymentSummaryValue, { color: '#10B981' }]}>₾{totalPaid.toFixed(2)}</Text>
                </View>
                <View style={[styles.paymentSummaryRow, styles.paymentSummaryTotal]}>
                  <Text style={styles.paymentSummaryLabelBold}>დარჩენილი:</Text>
                  <Text style={[
                    styles.paymentSummaryValueBold,
                    { color: getGrandTotal() - totalPaid <= 0 ? '#10B981' : '#EF4444' }
                  ]}>
                    ₾{Math.max(0, getGrandTotal() - totalPaid).toFixed(2)}
                  </Text>
                </View>
              </View>

              {loadingPayments ? (
                <View style={styles.loadingPaymentsContainer}>
                  <ActivityIndicator size="small" color="#10B981" />
                  <Text style={styles.loadingPaymentsText}>იტვირთება...</Text>
                </View>
              ) : payments.length === 0 ? (
                <View style={styles.emptyPaymentsContainer}>
                  <MaterialCommunityIcons name="cash-remove" size={40} color={COLORS.text.disabled} />
                  <Text style={styles.emptyPaymentsText}>გადახდები არ არის</Text>
                  <TouchableOpacity
                    onPress={() => setShowAddPaymentModal(true)}
                    style={styles.addPaymentButton}
                  >
                    <MaterialCommunityIcons name="plus" size={18} color="#10B981" />
                    <Text style={styles.addPaymentButtonText}>გადახდის დამატება</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.paymentsList}>
                  {payments.map((payment, index) => (
                    <View key={payment.id || index} style={styles.paymentItem}>
                      <View style={styles.paymentItemLeft}>
                        <View style={[styles.paymentMethodIcon, { backgroundColor: payment.paymentMethod === 'Cash' ? '#F59E0B15' : '#3B82F615' }]}>
                          <MaterialCommunityIcons
                            name={getPaymentMethodIcon(payment.paymentMethod)}
                            size={18}
                            color={payment.paymentMethod === 'Cash' ? '#F59E0B' : '#3B82F6'}
                          />
                        </View>
                        <View style={styles.paymentItemInfo}>
                          <Text style={styles.paymentItemAmount}>₾{payment.amount.toFixed(2)}</Text>
                          <Text style={styles.paymentItemMethod}>
                            {getPaymentMethodLabel(payment.paymentMethod, payment.method)}
                          </Text>
                          {payment.reference ? (
                            <Text style={styles.paymentItemReference}>რეფ: {payment.reference}</Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.paymentItemRight}>
                        <Text style={styles.paymentItemDate}>{formatPaymentDate(payment.paymentDate)}</Text>
                        <TouchableOpacity
                          onPress={() => handleDeletePayment(payment.id)}
                          style={styles.paymentDeleteButton}
                        >
                          <MaterialCommunityIcons name="delete-outline" size={20} color={COLORS.error} />
                        </TouchableOpacity>
                      </View>
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
                                  onPress={() => handleServiceCountChange(index, Math.max(0.1, normalized.count - 0.1).toFixed(1))}
                                  style={[styles.quantityButton, normalized.count <= 0.1 && styles.quantityButtonDisabled]}
                                  disabled={normalized.count <= 0.1}
                                >
                                  <MaterialCommunityIcons
                                    name="minus"
                                    size={18}
                                    color={normalized.count <= 0.1 ? COLORS.text.disabled : COLORS.primary}
                                  />
                                </TouchableOpacity>
                                <View style={styles.quantityDisplay}>
                                  <Text style={styles.quantityText}>{normalized.count % 1 === 0 ? normalized.count : normalized.count.toFixed(1)}</Text>
                                </View>
                                <TouchableOpacity
                                  onPress={() => handleServiceCountChange(index, (normalized.count + 0.1).toFixed(1))}
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
                                  {formatCurrencyGEL(normalized.basePrice || normalized.price)}
                                </Text>
                                <Text style={[styles.modernServicePrice, { color: COLORS.success }]}>
                                  {formatCurrencyGEL(normalized.price)}
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
          <Card style={styles.modernCard}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: COLORS.accent + '15' }]}>
                    <MaterialCommunityIcons name="car-cog" size={20} color={COLORS.accent} />
                  </View>
                  <Text style={styles.cardTitle}>ნაწილები {caseParts && caseParts.length > 0 ? `(${caseParts.length})` : ''}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowAddPartModal(true)}
                  style={styles.addServiceButton}
                >
                  <MaterialCommunityIcons name="plus-circle" size={28} color={COLORS.accent} />
                </TouchableOpacity>
              </View>

              {caseParts && caseParts.length > 0 ? (
                <>
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
                          <View style={styles.partPriceDeleteContainer}>
                            <Text style={styles.modernServicePrice}>{formatCurrencyGEL(part.totalPrice || (part.unitPrice * (part.quantity || 1)))}</Text>
                            <TouchableOpacity
                              onPress={() => handleDeletePart(index)}
                              style={styles.deletePartButton}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <MaterialCommunityIcons name="trash-can-outline" size={18} color={COLORS.error} />
                            </TouchableOpacity>
                          </View>
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
                </>
              ) : (
                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={() => setShowAddPartModal(true)}
                >
                  <MaterialCommunityIcons name="plus" size={24} color={COLORS.accent} />
                  <Text style={styles.emptyStateButtonText}>ნაწილის დამატება</Text>
                </TouchableOpacity>
              )}
            </Card.Content>
          </Card>

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
              keyboardType="decimal-pad"
              style={[styles.modernInput, { flex: 1, marginRight: 12 }]}
              outlineStyle={styles.inputOutline}
              left={<TextInput.Affix text="₾" />}
            />
            <TextInput
              label="რაოდენობა"
              value={newServiceCount}
              onChangeText={setNewServiceCount}
              mode="outlined"
              keyboardType="decimal-pad"
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

      {/* Add Part Modal */}
      <Portal>
        <Modal
          visible={showAddPartModal}
          onDismiss={() => setShowAddPartModal(false)}
          contentContainerStyle={styles.modernModal}
        >
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={[styles.iconCircle, { backgroundColor: COLORS.accent + '15' }]}>
                <MaterialCommunityIcons name="car-cog" size={20} color={COLORS.accent} />
              </View>
              <Text style={styles.modalTitle}>ნაწილის დამატება</Text>
            </View>
            <IconButton
              icon="close"
              size={24}
              onPress={() => setShowAddPartModal(false)}
              iconColor={COLORS.text.primary}
            />
          </View>

          <TextInput
            label="ნაწილის სახელი *"
            value={newPartNameInput}
            onChangeText={setNewPartNameInput}
            mode="outlined"
            style={styles.modernInput}
            outlineStyle={styles.inputOutline}
          />

          <TextInput
            label="ნაწილის ნომერი (არასავალდებულო)"
            value={newPartNumberInput}
            onChangeText={setNewPartNumberInput}
            mode="outlined"
            style={styles.modernInput}
            outlineStyle={styles.inputOutline}
          />

          <View style={styles.priceCountRow}>
            <TextInput
              label="ფასი *"
              value={newPartPrice}
              onChangeText={setNewPartPrice}
              mode="outlined"
              keyboardType="decimal-pad"
              style={[styles.modernInput, { flex: 1, marginRight: 12 }]}
              outlineStyle={styles.inputOutline}
              left={<TextInput.Affix text="₾" />}
            />
            <TextInput
              label="რაოდენობა"
              value={newPartQuantity}
              onChangeText={setNewPartQuantity}
              mode="outlined"
              keyboardType="decimal-pad"
              style={[styles.modernInput, { width: 110 }]}
              outlineStyle={styles.inputOutline}
            />
          </View>

          <TextInput
            label="შენიშვნა (არასავალდებულო)"
            value={newPartNotes}
            onChangeText={setNewPartNotes}
            mode="outlined"
            style={styles.modernInput}
            outlineStyle={styles.inputOutline}
            multiline
            numberOfLines={2}
          />

          <View style={styles.modernEditActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setShowAddPartModal(false);
                setNewPartNameInput('');
                setNewPartNumberInput('');
                setNewPartPrice('');
                setNewPartQuantity('1');
                setNewPartNotes('');
              }}
              style={styles.modernButton}
              textColor={COLORS.text.secondary}
            >
              გაუქმება
            </Button>
            <Button
              mode="contained"
              onPress={handleAddPart}
              style={[styles.modernButton, styles.primaryButton]}
              buttonColor={COLORS.accent}
              disabled={!newPartNameInput.trim() || !newPartPrice.trim()}
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
                  onChangeText={handleEditServicePriceChange}
                  mode="outlined"
                  keyboardType="decimal-pad"
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
                    onPress={() => {
                      const currentCount = parseFloat(editServiceCount) || 1;
                      handleEditServiceCountChange(Math.max(0.1, currentCount - 0.1).toFixed(1));
                    }}
                    style={[styles.modalQuantityButton, parseFloat(editServiceCount) <= 0.1 && styles.quantityButtonDisabled]}
                    disabled={parseFloat(editServiceCount) <= 0.1}
                  >
                    <MaterialCommunityIcons
                      name="minus"
                      size={20}
                      color={parseFloat(editServiceCount) <= 0.1 ? COLORS.text.disabled : COLORS.primary}
                    />
                  </TouchableOpacity>
                  <TextInput
                    value={editServiceCount}
                    onChangeText={setEditServiceCount}
                    keyboardType="decimal-pad"
                    style={styles.modalQuantityInput}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      const currentCount = parseFloat(editServiceCount) || 1;
                      handleEditServiceCountChange((currentCount + 0.1).toFixed(1));
                    }}
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
                {/* Show unit price */}
                <View style={styles.totalPreviewRow}>
                  <Text style={styles.totalPreviewLabel}>ერთეულის ფასი:</Text>
                  <Text style={styles.totalPreviewAmount}>
                    {formatCurrencyGEL(parseFloat(editServicePrice) || 0)}
                  </Text>
                </View>
                {/* Show calculated total (unit × count) */}
                <View style={styles.totalPreviewRow}>
                  <Text style={[styles.totalPreviewLabel, { fontWeight: '600' }]}>ჯამი:</Text>
                  <Text style={[styles.totalPreviewAmount, parseFloat(editServiceDiscount) > 0 && { textDecorationLine: 'line-through', color: COLORS.text.secondary }]}>
                    {formatCurrencyGEL((parseFloat(editServicePrice) || 0) * (parseFloat(editServiceCount) || 1))}
                  </Text>
                </View>
                {parseFloat(editServiceDiscount) > 0 && (
                  <View style={styles.totalPreviewRow}>
                    <Text style={[styles.totalPreviewLabel, { color: COLORS.success }]}>ფასდაკლებით:</Text>
                    <Text style={[styles.totalPreviewAmount, { color: COLORS.success }]}>
                      {formatCurrencyGEL((parseFloat(editServicePrice) || 0) * (parseFloat(editServiceCount) || 1) * (1 - (parseFloat(editServiceDiscount) || 0) / 100))}
                    </Text>
                  </View>
                )}
                {parseFloat(editServiceCount) > 1 && (
                  <Text style={styles.totalPreviewSubtext}>
                    {editServiceCount} × {formatCurrencyGEL(parseFloat(editServicePrice) || 0)}
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
                {loadingStatuses ? (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#8B5CF6" />
                    <Text style={{ marginTop: 8, color: COLORS.text.secondary }}>იტვირთება...</Text>
                  </View>
                ) : repairStatuses.length > 0 ? (
                  repairStatuses.map((status, index) => {
                    const isSelected = editingRepairStatusId === status.id;
                    const currentIndex = repairStatuses.findIndex(s => s.id === editingRepairStatusId);
                    const isPast = currentIndex > index && currentIndex !== -1;
                    const stepColor = status.color || '#8B5CF6';

                    return (
                      <TouchableOpacity
                        key={status.id}
                        style={[
                          styles.workflowStep,
                          isSelected && { backgroundColor: stepColor + '15', borderColor: stepColor },
                          isPast && { backgroundColor: stepColor + '08' }
                        ]}
                        onPress={() => {
                          setEditingRepairStatusId(status.id);
                          setEditingRepairStatus(status.name);
                        }}
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
                          ) : status.icon ? (
                            <MaterialCommunityIcons name={status.icon as any} size={14} color="#fff" />
                          ) : (
                            <Text style={styles.workflowStepNumber}>{index}</Text>
                          )}
                        </View>
                        <Text style={[
                          styles.workflowStepText,
                          isSelected && { color: stepColor, fontWeight: '600' },
                          isPast && { color: stepColor }
                        ]}>
                          {status.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  repairStatusOptions.map((option, index) => {
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
                  })
                )}
              </View>
            </View>

            {/* User Response Section */}
            <View style={styles.workflowSection}>
              <View style={styles.workflowSectionHeader}>
                <MaterialCommunityIcons name="clipboard-list" size={20} color="#10B981" />
                <Text style={styles.workflowSectionTitle}>საქმის სტატუსი</Text>
              </View>

              <View style={styles.userResponseGrid}>
                {loadingStatuses ? (
                  <View style={{ padding: 20, alignItems: 'center', width: '100%' }}>
                    <ActivityIndicator size="small" color="#10B981" />
                    <Text style={{ marginTop: 8, color: COLORS.text.secondary }}>იტვირთება...</Text>
                  </View>
                ) : caseStatuses.length > 0 ? (
                  caseStatuses.map((status) => {
                    const isSelected = editingCaseStatusId === status.id;
                    const statusColor = status.color || '#10B981';

                    return (
                      <TouchableOpacity
                        key={status.id}
                        style={[
                          styles.userResponseCard,
                          isSelected && { backgroundColor: statusColor + '15', borderColor: statusColor }
                        ]}
                        onPress={() => {
                          setEditingCaseStatusId(status.id);
                          setEditingCaseStatus(status.name);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          styles.userResponseIconContainer,
                          isSelected && { backgroundColor: statusColor + '20' }
                        ]}>
                          <MaterialCommunityIcons
                            name={(status.icon || 'file-document') as any}
                            size={24}
                            color={isSelected ? statusColor : '#94A3B8'}
                          />
                        </View>
                        <Text style={[
                          styles.userResponseText,
                          isSelected && { color: statusColor, fontWeight: '600' }
                        ]}>
                          {status.name}
                        </Text>
                        {isSelected && (
                          <View style={[styles.userResponseCheckmark, { backgroundColor: statusColor }]}>
                            <MaterialCommunityIcons name="check" size={12} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  caseStatusOptions.map((option) => {
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
                  })
                )}
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

      {/* Case Type Modal */}
      <Portal>
        <Modal
          visible={showCaseTypeModal}
          onDismiss={() => setShowCaseTypeModal(false)}
          contentContainerStyle={styles.caseTypeModal}
        >
          <View style={styles.caseTypeModalHeader}>
            <View style={styles.caseTypeModalTitleRow}>
              <MaterialCommunityIcons name="tag" size={24} color={COLORS.primary} />
              <Text style={styles.caseTypeModalTitle}>საქმის ტიპი</Text>
            </View>
            <IconButton
              icon="close"
              size={24}
              onPress={() => setShowCaseTypeModal(false)}
              iconColor={COLORS.text.primary}
            />
          </View>

          <View style={styles.caseTypeOptionsContainer}>
            {caseTypeOptions.map((option) => (
              <TouchableOpacity
                key={option.value || 'null'}
                style={[
                  styles.caseTypeOption,
                  caseType === option.value && styles.caseTypeOptionSelected,
                  { borderColor: option.color + '40' }
                ]}
                onPress={() => handleSaveCaseType(option.value)}
              >
                <View style={[styles.caseTypeOptionIcon, { backgroundColor: option.color + '15' }]}>
                  <MaterialCommunityIcons name={option.icon as any} size={24} color={option.color} />
                </View>
                <Text style={[
                  styles.caseTypeOptionLabel,
                  caseType === option.value && { color: option.color, fontWeight: '700' }
                ]}>
                  {option.label}
                </Text>
                {caseType === option.value && (
                  <MaterialCommunityIcons name="check-circle" size={24} color={option.color} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Modal>
      </Portal>

      {/* Mechanic Selection Modal */}
      <Portal>
        <Modal
          visible={showMechanicModal}
          onDismiss={() => setShowMechanicModal(false)}
          contentContainerStyle={styles.caseTypeModal}
        >
          <View style={styles.caseTypeModalHeader}>
            <View style={styles.caseTypeModalTitleRow}>
              <MaterialCommunityIcons name="account-wrench" size={24} color="#6366F1" />
              <Text style={styles.caseTypeModalTitle}>მექანიკოსის მინიჭება</Text>
            </View>
            <IconButton
              icon="close"
              size={24}
              onPress={() => setShowMechanicModal(false)}
              iconColor={COLORS.text.primary}
            />
          </View>

          <View style={styles.caseTypeOptionsContainer}>
            {loadingMechanics ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={{ color: COLORS.text.secondary, marginTop: 12 }}>იტვირთება მექანიკოსები...</Text>
              </View>
            ) : (
              mechanicOptions.map((option) => (
                <TouchableOpacity
                  key={option.value || 'null'}
                  style={[
                    styles.caseTypeOption,
                    assignedMechanic === option.value && styles.caseTypeOptionSelected,
                    { borderColor: '#6366F1' + '40' }
                  ]}
                  onPress={() => handleSaveMechanic(option.value)}
                  disabled={savingMechanic}
                >
                  <View style={[styles.caseTypeOptionIcon, { backgroundColor: '#6366F1' + '15' }]}>
                    <MaterialCommunityIcons 
                      name={option.value ? "account" : "account-off"} 
                      size={24} 
                      color={option.value ? '#6366F1' : '#94A3B8'} 
                    />
                  </View>
                  <Text style={[
                    styles.caseTypeOptionLabel,
                    assignedMechanic === option.value && { color: '#6366F1', fontWeight: '700' }
                  ]}>
                    {option.label}
                  </Text>
                  {assignedMechanic === option.value && (
                    <MaterialCommunityIcons name="check-circle" size={24} color="#6366F1" />
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>

          {savingMechanic && (
            <View style={styles.mechanicSavingOverlay}>
              <ActivityIndicator size="large" color="#6366F1" />
            </View>
          )}
        </Modal>
      </Portal>

      {/* Nachrebi Qty Modal */}
      <Portal>
        <Modal
          visible={showNachrebiQtyModal}
          onDismiss={() => setShowNachrebiQtyModal(false)}
          contentContainerStyle={styles.caseTypeModal}
        >
          <View style={styles.caseTypeModalHeader}>
            <View style={styles.caseTypeModalTitleRow}>
              <MaterialCommunityIcons name="package-variant" size={24} color="#10B981" />
              <Text style={styles.caseTypeModalTitle}>ნაჭრების რაოდენობა</Text>
            </View>
            <IconButton
              icon="close"
              size={24}
              onPress={() => setShowNachrebiQtyModal(false)}
              iconColor={COLORS.text.primary}
            />
          </View>

          <View style={styles.caseTypeOptionsContainer}>
            <TextInput
              label="რაოდენობა"
              value={editingNachrebiQty}
              onChangeText={setEditingNachrebiQty}
              mode="outlined"
              keyboardType="numeric"
              style={[styles.modernInput, { marginBottom: 16 }]}
              outlineStyle={styles.inputOutline}
              left={<TextInput.Icon icon="package-variant" />}
              placeholder="მაგ: 3"
            />
            
            <View style={styles.modernEditActions}>
              <Button
                mode="outlined"
                onPress={() => setShowNachrebiQtyModal(false)}
                style={styles.modernButton}
                textColor={COLORS.text.secondary}
              >
                გაუქმება
              </Button>
              <Button
                mode="contained"
                onPress={handleSaveNachrebiQty}
                style={[styles.modernButton, styles.primaryButton]}
                buttonColor="#10B981"
              >
                შენახვა
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* SMS Settings Modal */}
      <Portal>
        <Modal
          visible={smsSettingsVisible}
          onDismiss={() => {
            cancelEditingPhone();
            setSmsSettingsVisible(false);
          }}
          contentContainerStyle={styles.smsSettingsModal}
        >
          <View style={styles.smsSettingsHeader}>
            <View style={styles.smsSettingsTitleRow}>
              <MaterialCommunityIcons name="message-cog" size={24} color="#2196F3" />
              <Text style={styles.smsSettingsTitle}>SMS პარამეტრები</Text>
            </View>
            <IconButton
              icon="close"
              size={24}
              onPress={() => {
                cancelEditingPhone();
                setSmsSettingsVisible(false);
              }}
              iconColor={COLORS.text.primary}
            />
          </View>

          <Text style={styles.smsSettingsSubtitle}>აირჩიეთ SMS მიმღებები:</Text>

          <ScrollView style={styles.smsRecipientsList}>
            {smsRecipients.map((recipient) => (
              <View key={recipient.id} style={styles.smsRecipientRow}>
                <TouchableOpacity
                  style={styles.smsRecipientCheckbox}
                  onPress={() => toggleRecipient(recipient.id)}
                >
                  <MaterialCommunityIcons
                    name={recipient.enabled ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={28}
                    color={recipient.enabled ? '#2196F3' : COLORS.text.disabled}
                  />
                </TouchableOpacity>
                
                <View style={styles.smsRecipientInfo}>
                  <Text style={styles.smsRecipientName}>{recipient.name}</Text>
                  
                  {editingRecipient === recipient.id ? (
                    <View style={styles.smsPhoneEditContainer}>
                      <TextInput
                        style={styles.smsPhoneInput}
                        value={editingPhone}
                        onChangeText={setEditingPhone}
                        keyboardType="phone-pad"
                        autoFocus
                        placeholder="ტელეფონის ნომერი"
                        mode="outlined"
                        dense
                      />
                      <TouchableOpacity
                        style={styles.smsSavePhoneButton}
                        onPress={saveEditedPhone}
                      >
                        <MaterialCommunityIcons name="check" size={20} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.smsCancelPhoneButton}
                        onPress={cancelEditingPhone}
                      >
                        <MaterialCommunityIcons name="close" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.smsPhoneDisplayContainer}>
                      <Text style={styles.smsRecipientPhone}>{recipient.phone}</Text>
                      <TouchableOpacity
                        style={styles.smsEditPhoneButton}
                        onPress={() => startEditingPhone(recipient)}
                      >
                        <MaterialCommunityIcons name="pencil" size={18} color="#2196F3" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.smsSettingsFooter}>
            <Text style={styles.smsSelectedCount}>
              არჩეული: {getEnabledRecipients().length} მიმღები
            </Text>
            <TouchableOpacity
              style={styles.smsCloseButton}
              onPress={() => {
                cancelEditingPhone();
                setSmsSettingsVisible(false);
              }}
            >
              <Text style={styles.smsCloseButtonText}>დახურვა</Text>
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

      {/* Add Payment Modal */}
      <Portal>
        <Modal
          visible={showAddPaymentModal}
          onDismiss={() => {
            setShowAddPaymentModal(false);
            setPaymentAmount('');
            setPaymentMethod('Cash');
            setTransferMethod('BOG');
            setPaymentReference('');
            setPaymentNotes('');
          }}
          contentContainerStyle={styles.addPaymentModal}
        >
          <View style={styles.addPaymentModalHeader}>
            <View style={styles.addPaymentModalTitleRow}>
              <MaterialCommunityIcons name="cash-plus" size={24} color="#10B981" />
              <Text style={styles.addPaymentModalTitle}>გადახდის დამატება</Text>
            </View>
            <IconButton
              icon="close"
              size={24}
              onPress={() => {
                setShowAddPaymentModal(false);
                setPaymentAmount('');
                setPaymentMethod('Cash');
                setTransferMethod('BOG');
                setPaymentReference('');
                setPaymentNotes('');
              }}
              iconColor={COLORS.text.primary}
            />
          </View>

          <ScrollView style={styles.addPaymentModalContent}>
            {/* Amount Input */}
            <View style={styles.paymentInputGroup}>
              <Text style={styles.paymentInputLabel}>თანხა *</Text>
              <TextInput
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                mode="outlined"
                keyboardType="numeric"
                placeholder="0.00"
                style={styles.paymentAmountInput}
                outlineStyle={styles.inputOutline}
                left={<TextInput.Affix text="₾" />}
              />
            </View>

            {/* Payment Method Selection */}
            <View style={styles.paymentInputGroup}>
              <Text style={styles.paymentInputLabel}>გადახდის მეთოდი</Text>
              <View style={styles.paymentMethodOptions}>
                <TouchableOpacity
                  style={[
                    styles.paymentMethodOption,
                    paymentMethod === 'Cash' && styles.paymentMethodOptionSelected,
                    paymentMethod === 'Cash' && { borderColor: '#F59E0B' }
                  ]}
                  onPress={() => setPaymentMethod('Cash')}
                >
                  <MaterialCommunityIcons
                    name="cash"
                    size={24}
                    color={paymentMethod === 'Cash' ? '#F59E0B' : COLORS.text.secondary}
                  />
                  <Text style={[
                    styles.paymentMethodOptionText,
                    paymentMethod === 'Cash' && { color: '#F59E0B', fontWeight: '600' }
                  ]}>ნაღდი</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.paymentMethodOption,
                    paymentMethod === 'Transfer' && styles.paymentMethodOptionSelected,
                    paymentMethod === 'Transfer' && { borderColor: '#3B82F6' }
                  ]}
                  onPress={() => setPaymentMethod('Transfer')}
                >
                  <MaterialCommunityIcons
                    name="bank-transfer"
                    size={24}
                    color={paymentMethod === 'Transfer' ? '#3B82F6' : COLORS.text.secondary}
                  />
                  <Text style={[
                    styles.paymentMethodOptionText,
                    paymentMethod === 'Transfer' && { color: '#3B82F6', fontWeight: '600' }
                  ]}>გადარიცხვა</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bank Selection (only for Transfer) */}
            {paymentMethod === 'Transfer' && (
              <View style={styles.paymentInputGroup}>
                <Text style={styles.paymentInputLabel}>ბანკი</Text>
                <View style={styles.bankOptions}>
                  <TouchableOpacity
                    style={[
                      styles.bankOption,
                      transferMethod === 'BOG' && styles.bankOptionSelected
                    ]}
                    onPress={() => setTransferMethod('BOG')}
                  >
                    <Text style={[
                      styles.bankOptionText,
                      transferMethod === 'BOG' && styles.bankOptionTextSelected
                    ]}>BOG</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.bankOption,
                      transferMethod === 'TBC' && styles.bankOptionSelected
                    ]}
                    onPress={() => setTransferMethod('TBC')}
                  >
                    <Text style={[
                      styles.bankOptionText,
                      transferMethod === 'TBC' && styles.bankOptionTextSelected
                    ]}>TBC</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Reference Input */}
            <View style={styles.paymentInputGroup}>
              <Text style={styles.paymentInputLabel}>რეფერენსი / ნომერი</Text>
              <TextInput
                value={paymentReference}
                onChangeText={setPaymentReference}
                mode="outlined"
                placeholder="ტრანზაქციის ნომერი..."
                style={styles.paymentTextInput}
                outlineStyle={styles.inputOutline}
              />
            </View>

            {/* Notes Input */}
            <View style={styles.paymentInputGroup}>
              <Text style={styles.paymentInputLabel}>შენიშვნა</Text>
              <TextInput
                value={paymentNotes}
                onChangeText={setPaymentNotes}
                mode="outlined"
                multiline
                numberOfLines={2}
                placeholder="დამატებითი ინფორმაცია..."
                style={styles.paymentTextInput}
                outlineStyle={styles.inputOutline}
              />
            </View>
          </ScrollView>

          <View style={styles.addPaymentModalActions}>
            <TouchableOpacity
              style={styles.paymentCancelButton}
              onPress={() => {
                setShowAddPaymentModal(false);
                setPaymentAmount('');
                setPaymentMethod('Cash');
                setTransferMethod('BOG');
                setPaymentReference('');
                setPaymentNotes('');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.paymentCancelButtonText}>გაუქმება</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.paymentSaveButton, savingPayment && styles.paymentSaveButtonDisabled]}
              onPress={handleAddPayment}
              activeOpacity={0.8}
              disabled={savingPayment}
            >
              {savingPayment ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="check" size={20} color="#fff" />
                  <Text style={styles.paymentSaveButtonText}>შენახვა</Text>
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
  smsSentBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
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
    flexShrink: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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

  // Voice Notes styles
  recordingContainer: {
    backgroundColor: '#8B5CF615',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 10,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
  },
  recordingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  recordingActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  recordingButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelRecordingButton: {
    backgroundColor: '#FEE2E2',
  },
  stopRecordingButton: {
    backgroundColor: '#8B5CF6',
  },
  savingVoiceNoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  savingVoiceNoteText: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  voiceNotesList: {
    marginTop: 8,
  },
  voiceNoteItem: {
    paddingVertical: 12,
  },
  voiceNoteInfo: {
    flex: 1,
  },
  voiceNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceNoteAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  voiceNoteDuration: {
    fontSize: 12,
    color: COLORS.text.secondary,
    backgroundColor: '#8B5CF615',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  voiceNoteDate: {
    fontSize: 12,
    color: COLORS.text.disabled,
    marginTop: 4,
  },
  voiceNoteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  voiceNotePlayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8B5CF615',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceNotePlayingButton: {
    backgroundColor: '#8B5CF6',
  },
  voiceNoteDeleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Add Note Modal styles
  // Case Type Modal Styles
  caseTypeModal: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
  },
  caseTypeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  caseTypeModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  caseTypeModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  caseTypeOptionsContainer: {
    padding: 16,
    gap: 12,
  },
  caseTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
    gap: 14,
  },
  caseTypeOptionSelected: {
    borderWidth: 2,
    backgroundColor: '#F8FAFC',
  },
  caseTypeOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caseTypeOptionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  mechanicSavingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },

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

  // Payment styles
  paymentSummary: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  paymentSummaryTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 8,
    paddingTop: 12,
  },
  paymentSummaryLabel: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  paymentSummaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.primary,
  },
  paymentSummaryLabelBold: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  paymentSummaryValueBold: {
    fontSize: 16,
    fontWeight: '700',
  },
  loadingPaymentsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  loadingPaymentsText: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  emptyPaymentsContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyPaymentsText: {
    fontSize: 14,
    color: COLORS.text.disabled,
    marginTop: 8,
    marginBottom: 16,
  },
  addPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#10B98115',
    gap: 6,
  },
  addPaymentButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#10B981',
  },
  paymentsList: {
    gap: 12,
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
  },
  paymentItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentMethodIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentItemInfo: {
    flex: 1,
  },
  paymentItemAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  paymentItemMethod: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  paymentItemReference: {
    fontSize: 12,
    color: COLORS.text.disabled,
    marginTop: 2,
  },
  paymentItemRight: {
    alignItems: 'flex-end',
  },
  paymentItemDate: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginBottom: 4,
  },
  paymentDeleteButton: {
    padding: 4,
  },

  // Add Payment Modal styles
  addPaymentModal: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    maxHeight: '80%',
  },
  addPaymentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  addPaymentModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addPaymentModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  addPaymentModalContent: {
    padding: 20,
    maxHeight: 400,
  },
  paymentInputGroup: {
    marginBottom: 16,
  },
  paymentInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  paymentAmountInput: {
    backgroundColor: '#fff',
    fontSize: 18,
  },
  paymentTextInput: {
    backgroundColor: '#fff',
  },
  paymentMethodOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentMethodOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 8,
  },
  paymentMethodOptionSelected: {
    backgroundColor: '#fff',
  },
  paymentMethodOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  bankOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  bankOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  bankOptionSelected: {
    backgroundColor: '#3B82F615',
    borderColor: '#3B82F6',
  },
  bankOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  bankOptionTextSelected: {
    color: '#3B82F6',
  },
  addPaymentModalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  paymentCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  paymentSaveButton: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  paymentSaveButtonDisabled: {
    opacity: 0.7,
  },
  paymentSaveButtonText: {
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
  partPriceDeleteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deletePartButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: COLORS.error + '10',
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
  modalQuantityInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    minWidth: 50,
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
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: COLORS.accent + '10',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.accent + '30',
    borderStyle: 'dashed',
    gap: 8,
    marginTop: 8,
  },
  emptyStateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.accent,
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
  
  // SMS Settings Modal Styles
  smsSettingsModal: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    maxHeight: '80%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  smsSettingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
  },
  smsSettingsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  smsSettingsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  smsSettingsSubtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  smsRecipientsList: {
    paddingHorizontal: 20,
    maxHeight: 300,
  },
  smsRecipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline + '50',
  },
  smsRecipientCheckbox: {
    marginRight: 12,
  },
  smsRecipientInfo: {
    flex: 1,
  },
  smsRecipientName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  smsRecipientPhone: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  smsPhoneDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smsEditPhoneButton: {
    padding: 4,
  },
  smsPhoneEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smsPhoneInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#fff',
  },
  smsSavePhoneButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    padding: 8,
  },
  smsCancelPhoneButton: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    padding: 8,
  },
  smsSettingsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
    marginTop: 8,
  },
  smsSelectedCount: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  smsCloseButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  smsCloseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
