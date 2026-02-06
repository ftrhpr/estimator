import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Linking,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import {
    ActivityIndicator,
    Card,
    Chip,
    Divider,
    IconButton,
    Menu,
    Searchbar,
    Surface,
    Text
} from 'react-native-paper';

import { COLORS } from '../../src/config/constants';
import { DEFAULT_SERVICES } from '../../src/config/services';
import { fetchAllCPanelInvoices } from '../../src/services/cpanelService';
import { getAllInspections } from '../../src/services/firebase';
import { sendCompletionSMS } from '../../src/services/smsService';
import { formatCurrencyGEL } from '../../src/utils/helpers';

const { width } = Dimensions.get('window');

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

interface InspectionCase {
  id: string;
  customerName?: string;
  customerPhone: string;
  carMake?: string;
  carModel?: string;
  plate?: string;
  totalPrice: number;
  services?: Array<{ serviceName: string; price: number; count: number; key?: string }>;
  parts?: any[];
  status: string;
  repair_status?: string | null;
  createdAt: string;
  updatedAt: string;
  cpanelInvoiceId?: string;
  includeVAT?: boolean;
  vatAmount?: number;
  servicesDiscount?: number;
  partsDiscount?: number;
  globalDiscount?: number;
  caseType?: string | null;
  assignedMechanic?: string | null;
}

interface CaseWithDetails extends InspectionCase {
  statusColor: string;
  statusLabel: string;
  source: 'firebase' | 'cpanel';
  completedDaysAgo: number;
  caseType?: string | null;
  assignedMechanic?: string | null;
  assigned_mechanic?: string | null;
}

// Calculate total price with VAT and discounts for a case
const calculateCaseTotal = (caseItem: CaseWithDetails): number => {
  const servicesSubtotal = (caseItem.services || []).reduce((sum, s) => {
    return sum + (s.price || 0);
  }, 0);
  
  const partsSubtotal = (caseItem.parts || []).reduce((sum: number, p: any) => {
    return sum + (p.totalPrice || (p.unitPrice * (p.quantity || 1)) || 0);
  }, 0);
  
  const servicesDiscount = (caseItem.servicesDiscount || 0) / 100;
  const servicesTotal = servicesSubtotal * (1 - servicesDiscount);
  
  const partsDiscount = (caseItem.partsDiscount || 0) / 100;
  const partsTotal = partsSubtotal * (1 - partsDiscount);
  
  const subtotal = servicesTotal + partsTotal;
  
  const globalDiscount = (caseItem.globalDiscount || 0) / 100;
  const subtotalAfterGlobalDiscount = subtotal * (1 - globalDiscount);
  
  const vatAmount = caseItem.includeVAT ? subtotalAfterGlobalDiscount * 0.18 : 0;
  
  return subtotalAfterGlobalDiscount + vatAmount;
};

export default function CompletedCasesScreen() {
  const [cases, setCases] = useState<CaseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'cost_high' | 'cost_low'>('newest');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [sendingSmsId, setSendingSmsId] = useState<string | null>(null);
  const [sentSmsIds, setSentSmsIds] = useState<Set<string>>(new Set());
  
  // SMS Settings Modal state
  const [smsSettingsVisible, setSmsSettingsVisible] = useState(false);
  const [smsRecipients, setSmsRecipients] = useState<SMSRecipient[]>(DEFAULT_SMS_RECIPIENTS);
  const [editingRecipient, setEditingRecipient] = useState<string | null>(null);
  const [editingPhone, setEditingPhone] = useState('');

  // Load SMS recipients from AsyncStorage
  const loadSmsRecipients = async () => {
    try {
      const stored = await AsyncStorage.getItem(SMS_RECIPIENTS_STORAGE_KEY);
      if (stored) {
        const savedRecipients: SMSRecipient[] = JSON.parse(stored);
        // Merge with defaults to ensure all recipients exist (in case new ones were added)
        const mergedRecipients = DEFAULT_SMS_RECIPIENTS.map(defaultRecipient => {
          const saved = savedRecipients.find(s => s.id === defaultRecipient.id);
          if (saved) {
            // Keep saved phone number and enabled status
            return { ...defaultRecipient, phone: saved.phone, enabled: saved.enabled };
          }
          // New recipient not in saved data - use default
          return defaultRecipient;
        });
        setSmsRecipients(mergedRecipients);
        // Save merged list back to storage
        await AsyncStorage.setItem(SMS_RECIPIENTS_STORAGE_KEY, JSON.stringify(mergedRecipients));
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
  const toggleRecipient = (id: string) => {
    const updated = smsRecipients.map(r => 
      r.id === id ? { ...r, enabled: !r.enabled } : r
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
  const cancelEditing = () => {
    setEditingRecipient(null);
    setEditingPhone('');
  };

  // Get enabled recipients
  const getEnabledRecipients = () => {
    return smsRecipients.filter(r => r.enabled);
  };

  // Load sent SMS IDs from AsyncStorage
  const loadSentSmsIds = async () => {
    try {
      const stored = await AsyncStorage.getItem('sentSmsIds');
      if (stored) {
        setSentSmsIds(new Set(JSON.parse(stored)));
      }
    } catch (error) {
      console.error('Error loading sent SMS IDs:', error);
    }
  };

  // Save sent SMS ID to AsyncStorage
  const markSmsSent = async (caseId: string) => {
    try {
      const newSentIds = new Set(sentSmsIds);
      newSentIds.add(caseId);
      setSentSmsIds(newSentIds);
      await AsyncStorage.setItem('sentSmsIds', JSON.stringify([...newSentIds]));
    } catch (error) {
      console.error('Error saving sent SMS ID:', error);
    }
  };

  useEffect(() => {
    loadSentSmsIds();
    loadSmsRecipients();
  }, []);

  const loadCompletedCases = async () => {
    try {
      setLoading(true);
      
      // Load from Firebase - include all "Completed" status variations
      const inspections = await getAllInspections();
      const completedStatuses = ['Completed', 'completed', 'დასრულებული', 'COMPLETED'];
      
      // Debug: Log all unique statuses found
      const allStatuses = [...new Set(inspections.map((i: any) => i.status))];
      console.log('[Completed] All Firebase statuses found:', allStatuses);
      
      const firebaseCases: CaseWithDetails[] = inspections
        .filter((inspection: any) => {
          const isCompleted = completedStatuses.includes(inspection.status);
          if (!isCompleted && inspection.status?.toLowerCase?.()?.includes?.('complet')) {
            console.log('[Completed] Potential missed case:', inspection.status, inspection.plate);
          }
          return isCompleted;
        })
        .map((inspection: any) => {
          // Debug: log dates for completed cases
          console.log('[Completed] Firebase case dates:', {
            plate: inspection.plate,
            updatedAt: inspection.updatedAt,
            createdAt: inspection.createdAt,
            usedDate: inspection.updatedAt || inspection.createdAt
          });
          const completedDaysAgo = Math.floor((Date.now() - new Date(inspection.updatedAt || inspection.createdAt).getTime()) / (1000 * 60 * 60 * 24));
          return {
            id: inspection.id,
            customerName: inspection.customerName || 'N/A',
            customerPhone: inspection.customerPhone || 'N/A',
            carMake: inspection.carMake || '',
            carModel: inspection.carModel || 'Unknown',
            plate: inspection.plate || inspection.carModel || 'N/A',
            totalPrice: inspection.totalPrice || 0,
            services: inspection.services || [],
            parts: inspection.parts || [],
            status: inspection.status || 'Completed',
            repair_status: inspection.repair_status || null,
            createdAt: inspection.createdAt,
            updatedAt: inspection.updatedAt,
            cpanelInvoiceId: inspection.cpanelInvoiceId || '',
            statusColor: COLORS.success,
            statusLabel: getCompletedLabel(inspection.updatedAt || inspection.createdAt),
            source: 'firebase' as const,
            includeVAT: inspection.includeVAT || false,
            vatAmount: inspection.vatAmount || 0,
            servicesDiscount: inspection.services_discount_percent || 0,
            partsDiscount: inspection.parts_discount_percent || 0,
            globalDiscount: inspection.global_discount_percent || 0,
            completedDaysAgo,
            caseType: inspection.caseType || null,
            assignedMechanic: inspection.assignedMechanic || null,
          };
        });

      // Load from CPanel
      let cpanelCompletedCases: CaseWithDetails[] = [];
      try {
        const result: any = await fetchAllCPanelInvoices({ limit: 200, onlyCPanelOnly: true });
        if (result.success && result.invoices) {
          // Debug: Log all unique cPanel statuses
          const cpanelStatuses = [...new Set(result.invoices.map((i: any) => i.status))];
          console.log('[Completed] All cPanel statuses found:', cpanelStatuses);
          
          cpanelCompletedCases = result.invoices
            .filter((invoice: any) => completedStatuses.includes(invoice.status))
            .map((invoice: any) => {
              const completedDaysAgo = Math.floor((Date.now() - new Date(invoice.updatedAt || invoice.createdAt).getTime()) / (1000 * 60 * 60 * 24));
              return {
                id: invoice.cpanelId?.toString() || '',
                customerName: invoice.customerName || 'N/A',
                customerPhone: invoice.customerPhone || 'N/A',
                carMake: invoice.carMake || '',
                carModel: invoice.carModel || 'Unknown',
                plate: invoice.plate || invoice.carModel || 'N/A',
                totalPrice: invoice.totalPrice || 0,
                services: invoice.services || [],
                parts: invoice.parts || [],
                status: invoice.status || 'Completed',
                repair_status: invoice.repair_status || null,
                createdAt: invoice.createdAt,
                updatedAt: invoice.updatedAt,
                cpanelInvoiceId: invoice.cpanelId?.toString() || '',
                statusColor: COLORS.success,
                statusLabel: getCompletedLabel(invoice.updatedAt || invoice.createdAt),
                source: 'cpanel' as const,
                includeVAT: invoice.includeVAT || false,
                vatAmount: invoice.vatAmount || 0,
                servicesDiscount: invoice.services_discount_percent || 0,
                partsDiscount: invoice.parts_discount_percent || 0,
                globalDiscount: invoice.global_discount_percent || 0,
                completedDaysAgo,
                caseType: invoice.caseType || null,
                assignedMechanic: invoice.assigned_mechanic || invoice.assignedMechanic || null,
              };
            });
        }
      } catch (error) {
        console.error('Error loading cPanel completed cases:', error);
      }

      // Combine and sort by date (handle null/undefined dates)
      const allCompletedCases = [...firebaseCases, ...cpanelCompletedCases];
      allCompletedCases.sort((a, b) => {
        const dateA = a.updatedAt || a.createdAt || '1970-01-01';
        const dateB = b.updatedAt || b.createdAt || '1970-01-01';
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
      
      console.log('[Completed] Total loaded:', {
        firebase: firebaseCases.length,
        cpanel: cpanelCompletedCases.length,
        total: allCompletedCases.length,
        firebasePlates: firebaseCases.map(c => c.plate),
        cpanelPlates: cpanelCompletedCases.map(c => c.plate),
      });
      
      setCases(allCompletedCases);
    } catch (error) {
      console.error('Error loading completed cases:', error);
      Alert.alert('კავშირის შეცდომა', 'დასრულებული შემთხვევების ჩატვირთვა ვერ მოხერხდა.');
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCompletedCases();
    setRefreshing(false);
  };

  const getServiceNameGeorgian = (serviceName: string): string => {
    if (!serviceName) return '';
    
    const serviceKey = serviceName.toLowerCase().replace(/\s+/g, '_');
    if (DEFAULT_SERVICES[serviceKey as keyof typeof DEFAULT_SERVICES]) {
      return DEFAULT_SERVICES[serviceKey as keyof typeof DEFAULT_SERVICES].nameKa;
    }
    
    for (const key of Object.keys(DEFAULT_SERVICES)) {
      const service = DEFAULT_SERVICES[key as keyof typeof DEFAULT_SERVICES];
      if (service.nameEn.toLowerCase() === serviceName.toLowerCase()) {
        return service.nameKa;
      }
    }
    return serviceName;
  };

  const normalizeService = (service: any) => {
    const georgianName = service.serviceNameKa || service.nameKa || '';
    const englishName = service.serviceName || service.description || service.name || 'Unknown';
    
    return {
      serviceName: georgianName || getServiceNameGeorgian(englishName) || englishName,
      price: service.price || service.hourly_rate || service.rate || 0,
      count: service.count || 1,
    };
  };

  // Scroll position preservation
  const flatListRef = useRef<FlatList>(null);
  const scrollOffsetRef = useRef<number>(0);
  const shouldRestoreScrollRef = useRef<boolean>(false);

  useFocusEffect(
    useCallback(() => {
      // Only reload data if not restoring scroll position
      if (!shouldRestoreScrollRef.current) {
        loadCompletedCases();
      } else {
        // Restore scroll position after a brief delay
        setTimeout(() => {
          if (flatListRef.current && scrollOffsetRef.current > 0) {
            flatListRef.current.scrollToOffset({
              offset: scrollOffsetRef.current,
              animated: false,
            });
          }
          shouldRestoreScrollRef.current = false;
        }, 50);
      }
    }, [])
  );

  const getCompletedLabel = (completedAt: string | null | undefined): string => {
    if (!completedAt) return 'თარიღი უცნობია';
    
    const completedDate = new Date(completedAt);
    
    // Check if date is valid
    if (isNaN(completedDate.getTime())) {
      console.warn('[Completed] Invalid date:', completedAt);
      return 'თარიღი უცნობია';
    }
    
    const daysSinceCompleted = Math.floor((Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Debug log for recently completed cases
    if (daysSinceCompleted > 1) {
      console.log('[Completed] Date debug:', { completedAt, daysSinceCompleted, now: new Date().toISOString() });
    }
    
    if (daysSinceCompleted === 0) return 'დღეს';
    if (daysSinceCompleted === 1) return 'გუშინ';
    if (daysSinceCompleted <= 7) return `${daysSinceCompleted} დღის წინ`;
    if (daysSinceCompleted <= 30) return `${Math.floor(daysSinceCompleted / 7)} კვირის წინ`;
    return `${Math.floor(daysSinceCompleted / 30)} თვის წინ`;
  };

  const filterAndSortCases = () => {
    let filteredCases = cases;

    // Filter by search
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filteredCases = filteredCases.filter(caseItem => {
        return (
          (caseItem.plate?.toLowerCase() || '').includes(searchLower) ||
          (caseItem.carModel?.toLowerCase() || '').includes(searchLower) ||
          (caseItem.carMake?.toLowerCase() || '').includes(searchLower) ||
          (caseItem.customerName?.toLowerCase() || '').includes(searchLower) ||
          (caseItem.customerPhone?.toLowerCase() || '').includes(searchLower) ||
          (caseItem.services?.some(s => s.serviceName.toLowerCase().includes(searchLower)) || false)
        );
      });
    }

    // Sort cases
    filteredCases.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'oldest':
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case 'cost_high':
          return calculateCaseTotal(b) - calculateCaseTotal(a);
        case 'cost_low':
          return calculateCaseTotal(a) - calculateCaseTotal(b);
        default:
          return 0;
      }
    });

    return filteredCases;
  };

  const handleCallCustomer = (phone: string) => {
    if (!phone || phone === 'N/A') {
      Alert.alert('შეცდომა', 'ტელეფონის ნომერი არ არის მითითებული');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleSendCompletionSMS = async (caseItem: CaseWithDetails) => {
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
    
    const caseTotal = calculateCaseTotal(caseItem);
    const caseTypeLabel = caseItem.caseType || 'არ არის მითითებული';
    const mechanicName = caseItem.assignedMechanic || caseItem.assigned_mechanic || null;
    const caseKey = `${caseItem.source}-${caseItem.id}`;
    const alreadySent = sentSmsIds.has(caseKey);
    
    // Build recipient list for display
    const recipientNames = enabledRecipients.map(r => `${r.name} (${r.phone})`).join(', ');
    
    // Build alert message
    let alertMessage = `${alreadySent ? '⚠️ SMS უკვე გაგზავნილია!\n\n' : ''}გსურთ დასრულების შეტყობინების გაგზავნა?\n\nმიმღებები: ${recipientNames}\n\nავტომობილი: ${caseItem.plate}\nტიპი: ${caseTypeLabel}`;
    if (caseItem.caseType === 'დაზღვევა' && mechanicName) {
      alertMessage += `\nმექანიკოსი: ${mechanicName}`;
    }
    alertMessage += `\nჯამი: ${caseTotal.toFixed(2)} ₾`;
    
    Alert.alert(
      alreadySent ? 'SMS ხელახლა გაგზავნა' : 'SMS გაგზავნა',
      alertMessage,
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: alreadySent ? 'ხელახლა გაგზავნა' : 'გაგზავნა',
          onPress: async () => {
            try {
              setSendingSmsId(caseKey);
              
              // Send SMS to all enabled recipients
              const results = await Promise.all(
                enabledRecipients.map(recipient => 
                  sendCompletionSMS(
                    recipient.phone,
                    caseItem.plate || 'N/A',
                    caseTotal,
                    caseItem.caseType,
                    mechanicName
                  )
                )
              );
              
              const successCount = results.filter(r => r.success).length;
              const failCount = results.filter(r => !r.success).length;
              
              if (successCount > 0) {
                await markSmsSent(caseKey);
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
              setSendingSmsId(null);
            }
          }
        }
      ]
    );
  };

  const getStatistics = () => {
    const filteredCases = filterAndSortCases();
    const totalRevenue = filteredCases.reduce((sum, c) => sum + calculateCaseTotal(c), 0);
    const thisWeek = filteredCases.filter(c => c.completedDaysAgo <= 7).length;
    const thisMonth = filteredCases.filter(c => c.completedDaysAgo <= 30).length;
    
    return { total: filteredCases.length, totalRevenue, thisWeek, thisMonth };
  };

  const renderCaseCard = ({ item }: { item: CaseWithDetails }) => {
    const caseTotal = calculateCaseTotal(item);
    const services = item.services?.slice(0, 3) || [];
    
    const handleCardPress = () => {
      // Save scroll position before navigation
      shouldRestoreScrollRef.current = true;
      // For CPanel-only cases, pass source parameter
      if (item.source === 'cpanel') {
        router.push(`/cases/${item.id}?source=cpanel`);
      } else {
        router.push(`/cases/${item.id}`);
      }
    };

    return (
      <Card style={styles.caseCard} onPress={handleCardPress}>
        <View style={styles.cardContent}>
          {/* Header with plate and status */}
          <View style={styles.cardHeader}>
            <View style={styles.plateContainer}>
              <MaterialCommunityIcons name="car" size={20} color={COLORS.primary} />
              <Text style={styles.plateText}>{item.plate}</Text>
            </View>
            <View style={styles.headerRight}>
              <Chip
                mode="flat"
                style={[styles.statusChip, { backgroundColor: COLORS.success + '20' }]}
                textStyle={[styles.statusChipText, { color: COLORS.success }]}
              >
                დასრულებული
              </Chip>
            </View>
          </View>

          {/* Vehicle make/model */}
          {(item.carMake || item.carModel) && (
            <View style={styles.vehicleInfo}>
              <MaterialCommunityIcons name="car-info" size={16} color={COLORS.text.secondary} />
              <Text style={styles.vehicleText}>
                {[item.carMake, item.carModel].filter(Boolean).join(' ')}
              </Text>
            </View>
          )}

          {/* Completed date */}
          <View style={styles.completedContainer}>
            <View style={[styles.completedBadge, { backgroundColor: COLORS.success + '15' }]}>
              <MaterialCommunityIcons name="check-circle" size={16} color={COLORS.success} />
              <Text style={[styles.completedText, { color: COLORS.success }]}>
                დასრულდა: {item.statusLabel}
              </Text>
            </View>
          </View>

          {/* Customer info */}
          <View style={styles.customerRow}>
            <View style={styles.customerInfo}>
              <MaterialCommunityIcons name="account" size={18} color={COLORS.text.secondary} />
              <Text style={styles.customerName} numberOfLines={1}>
                {item.customerName || 'უცნობი კლიენტი'}
              </Text>
            </View>
            {item.customerPhone && item.customerPhone !== 'N/A' && (
              <TouchableOpacity 
                style={styles.phoneButton}
                onPress={() => handleCallCustomer(item.customerPhone)}
              >
                <MaterialCommunityIcons name="phone" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </View>

          <Divider style={styles.divider} />

          {/* Services preview */}
          <View style={styles.servicesContainer}>
            {services.length > 0 ? (
              <>
                {services.map((service, index) => {
                  const normalized = normalizeService(service);
                  return (
                    <View key={index} style={styles.serviceRow}>
                      <Text style={styles.serviceName} numberOfLines={1}>
                        {normalized.serviceName}
                      </Text>
                      <Text style={styles.servicePrice}>
                        {formatCurrencyGEL(normalized.price)}
                      </Text>
                    </View>
                  );
                })}
                {(item.services?.length || 0) > 3 && (
                  <Text style={styles.moreServices}>
                    +{(item.services?.length || 0) - 3} სხვა სერვისი
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.noServices}>სერვისები არ არის დამატებული</Text>
            )}
          </View>

          {/* Footer with total and SMS button */}
          <View style={styles.cardFooter}>
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>ჯამი:</Text>
              <Text style={styles.totalAmount}>{formatCurrencyGEL(caseTotal)}</Text>
              {item.includeVAT && (
                <View style={styles.vatBadge}>
                  <Text style={styles.vatBadgeText}>+დღგ</Text>
                </View>
              )}
            </View>
            <View style={styles.footerActions}>
              <TouchableOpacity 
                style={[
                  styles.smsButton,
                  sendingSmsId === `${item.source}-${item.id}` && styles.smsButtonDisabled,
                  sentSmsIds.has(`${item.source}-${item.id}`) && styles.smsButtonSent
                ]}
                onPress={() => handleSendCompletionSMS(item)}
                disabled={sendingSmsId === `${item.source}-${item.id}`}
              >
                {sendingSmsId === `${item.source}-${item.id}` ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : sentSmsIds.has(`${item.source}-${item.id}`) ? (
                  <>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#fff" />
                    <Text style={styles.smsButtonText}>SMS ✓</Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons name="message-text" size={16} color="#fff" />
                    <Text style={styles.smsButtonText}>SMS</Text>
                  </>
                )}
              </TouchableOpacity>
              <View style={styles.completedIndicator}>
                <MaterialCommunityIcons name="check-all" size={20} color={COLORS.success} />
              </View>
            </View>
          </View>
        </View>
      </Card>
    );
  };

  const filteredCases = filterAndSortCases();
  const stats = getStatistics();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>იტვირთება...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Surface style={styles.header} elevation={2}>
        <View style={styles.headerContent}>
          <View style={styles.titleRow}>
            <Text style={styles.headerTitle}>დასრულებული</Text>
            <Chip mode="flat" style={styles.countChip}>
              {filteredCases.length}
            </Chip>
          </View>
          <View style={styles.headerActions}>
            <IconButton 
              icon="message-cog" 
              onPress={() => setSmsSettingsVisible(true)} 
              iconColor={COLORS.text.secondary}
            />
            <IconButton 
              icon="magnify" 
              onPress={() => setShowSearch(!showSearch)} 
              iconColor={showSearch ? COLORS.primary : COLORS.text.secondary}
            />
            <Menu
              visible={sortMenuVisible}
              onDismiss={() => setSortMenuVisible(false)}
              anchor={
                <IconButton 
                  icon="sort" 
                  onPress={() => setSortMenuVisible(true)}
                  iconColor={COLORS.text.secondary}
                />
              }
            >
              <Menu.Item onPress={() => { setSortBy('newest'); setSortMenuVisible(false); }} title="უახლესი" leadingIcon={sortBy === 'newest' ? 'check' : undefined} />
              <Menu.Item onPress={() => { setSortBy('oldest'); setSortMenuVisible(false); }} title="უძველესი" leadingIcon={sortBy === 'oldest' ? 'check' : undefined} />
              <Divider />
              <Menu.Item onPress={() => { setSortBy('cost_high'); setSortMenuVisible(false); }} title="ფასი (მაღალი)" leadingIcon={sortBy === 'cost_high' ? 'check' : undefined} />
              <Menu.Item onPress={() => { setSortBy('cost_low'); setSortMenuVisible(false); }} title="ფასი (დაბალი)" leadingIcon={sortBy === 'cost_low' ? 'check' : undefined} />
            </Menu>
          </View>
        </View>
        
        {showSearch && (
          <Searchbar
            placeholder="ძებნა..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
          />
        )}

        {/* Statistics Row */}
        <View style={styles.statsContainer}>
          <View style={[styles.statBox, { backgroundColor: COLORS.success + '15' }]}>
            <Text style={[styles.statValue, { color: COLORS.success }]}>{stats.total}</Text>
            <Text style={[styles.statLabel, { color: COLORS.success }]}>სულ</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#2196F3' + '15' }]}>
            <Text style={[styles.statValue, { color: '#2196F3' }]}>{stats.thisWeek}</Text>
            <Text style={[styles.statLabel, { color: '#2196F3' }]}>ამ{"\n"}კვირას</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#9C27B0' + '15' }]}>
            <Text style={[styles.statValue, { color: '#9C27B0' }]}>{stats.thisMonth}</Text>
            <Text style={[styles.statLabel, { color: '#9C27B0' }]}>ამ{"\n"}თვეში</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: COLORS.primary + '15' }]}>
            <Text style={[styles.statValue, { color: COLORS.primary, fontSize: 16 }]}>{formatCurrencyGEL(stats.totalRevenue)}</Text>
            <Text style={[styles.statLabel, { color: COLORS.primary }]}>შემოსავალი</Text>
          </View>
        </View>
      </Surface>

      {/* Cases List */}
      {filteredCases.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="check-circle-outline" size={64} color={COLORS.text.disabled} />
          <Text style={styles.emptyTitle}>
            {searchQuery 
              ? 'შედეგები არ მოიძებნა' 
              : 'დასრულებული შემთხვევები არ არის'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery 
              ? 'სცადეთ სხვა საძიებო სიტყვა'
              : 'როდესაც შემთხვევას დაასრულებთ, ის აქ გამოჩნდება'}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredCases}
          renderItem={renderCaseCard}
          keyExtractor={(item) => `${item.source}-${item.id}`}
          contentContainerStyle={styles.listContent}
          onScroll={(event) => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
            />
          }
        />
      )}

      {/* SMS Settings Modal */}
      <Modal
        visible={smsSettingsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSmsSettingsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.smsSettingsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>SMS პარამეტრები</Text>
              <IconButton
                icon="close"
                size={24}
                onPress={() => {
                  cancelEditing();
                  setSmsSettingsVisible(false);
                }}
              />
            </View>
            
            <Text style={styles.modalSubtitle}>აირჩიეთ SMS მიმღებები:</Text>
            
            <ScrollView style={styles.recipientsList}>
              {smsRecipients.map((recipient) => (
                <View key={recipient.id} style={styles.recipientRow}>
                  <TouchableOpacity
                    style={styles.recipientCheckbox}
                    onPress={() => toggleRecipient(recipient.id)}
                  >
                    <MaterialCommunityIcons
                      name={recipient.enabled ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      size={28}
                      color={recipient.enabled ? COLORS.primary : COLORS.text.disabled}
                    />
                  </TouchableOpacity>
                  
                  <View style={styles.recipientInfo}>
                    <Text style={styles.recipientName}>{recipient.name}</Text>
                    
                    {editingRecipient === recipient.id ? (
                      <View style={styles.phoneEditContainer}>
                        <TextInput
                          style={styles.phoneInput}
                          value={editingPhone}
                          onChangeText={setEditingPhone}
                          keyboardType="phone-pad"
                          autoFocus
                          placeholder="ტელეფონის ნომერი"
                        />
                        <TouchableOpacity
                          style={styles.savePhoneButton}
                          onPress={saveEditedPhone}
                        >
                          <MaterialCommunityIcons name="check" size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.cancelPhoneButton}
                          onPress={cancelEditing}
                        >
                          <MaterialCommunityIcons name="close" size={20} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.phoneDisplayContainer}>
                        <Text style={styles.recipientPhone}>{recipient.phone}</Text>
                        <TouchableOpacity
                          style={styles.editPhoneButton}
                          onPress={() => startEditingPhone(recipient)}
                        >
                          <MaterialCommunityIcons name="pencil" size={18} color={COLORS.primary} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <Text style={styles.selectedCount}>
                არჩეული: {getEnabledRecipients().length} მიმღები
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  cancelEditing();
                  setSmsSettingsVisible(false);
                }}
              >
                <Text style={styles.modalCloseButtonText}>დახურვა</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.text.secondary,
    fontSize: 16,
  },
  header: {
    backgroundColor: COLORS.surface,
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  countChip: {
    backgroundColor: COLORS.success + '20',
    height: 28,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBar: {
    marginTop: 12,
    backgroundColor: COLORS.background,
    elevation: 0,
  },
  searchInput: {
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 70,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 13,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  caseCard: {
    marginBottom: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    elevation: 2,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 14,
    paddingTop: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  plateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plateText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusChip: {
    height: 28,
    paddingHorizontal: 4,
  },
  statusChipText: {
    fontSize: 9,
    fontWeight: '700',
    marginHorizontal: 2,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingLeft: 2,
  },
  vehicleText: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  completedContainer: {
    marginBottom: 12,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  completedText: {
    fontSize: 13,
    fontWeight: '600',
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  customerName: {
    fontSize: 14,
    color: COLORS.text.secondary,
    flex: 1,
  },
  phoneButton: {
    padding: 8,
    backgroundColor: COLORS.primary + '10',
    borderRadius: 20,
  },
  divider: {
    marginVertical: 12,
  },
  servicesContainer: {
    gap: 6,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceName: {
    fontSize: 14,
    color: COLORS.text.primary,
    flex: 1,
    marginRight: 8,
  },
  servicePrice: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  moreServices: {
    fontSize: 12,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  noServices: {
    fontSize: 14,
    color: COLORS.text.disabled,
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  totalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  totalLabel: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  vatBadge: {
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  vatBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.success,
  },
  completedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 70,
    justifyContent: 'center',
  },
  smsButtonDisabled: {
    backgroundColor: '#90CAF9',
  },
  smsButtonSent: {
    backgroundColor: '#4CAF50',
  },
  smsButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.text.disabled,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  // SMS Settings Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  smsSettingsModal: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  recipientsList: {
    paddingHorizontal: 20,
    maxHeight: 300,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline + '50',
  },
  recipientCheckbox: {
    marginRight: 12,
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  recipientPhone: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  phoneDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editPhoneButton: {
    padding: 4,
  },
  phoneEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.text.primary,
    backgroundColor: COLORS.background,
  },
  savePhoneButton: {
    backgroundColor: COLORS.success,
    borderRadius: 8,
    padding: 8,
  },
  cancelPhoneButton: {
    backgroundColor: COLORS.error,
    borderRadius: 8,
    padding: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
    marginTop: 8,
  },
  selectedCount: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  modalCloseButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalCloseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
