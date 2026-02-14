import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Linking,
    Modal,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import {
    ActivityIndicator,
    Button,
    Card,
    Chip,
    Divider,
    FAB,
    IconButton,
    Menu,
    Searchbar,
    Surface,
    Text
} from 'react-native-paper';

import { COLORS } from '../../src/config/constants';
import { DEFAULT_SERVICES } from '../../src/config/services';
import { fetchAllCPanelInvoices, fetchInvoiceFromCPanel } from '../../src/services/cpanelService';
import { getAllInspections } from '../../src/services/firebase';
import { formatCurrencyGEL } from '../../src/utils/helpers';

const { width } = Dimensions.get('window');

// Status colors based on case age
const STATUS_COLORS = {
  today: '#10B981',
  recent: '#F59E0B',
  old: '#EF4444',
};

interface InspectionCase {
  id: string;
  customerName?: string;
  customerPhone: string;
  carMake?: string;
  carModel?: string;
  carMakeId?: string;
  carModelId?: string;
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
  assignedMechanic?: string | null;
}

interface CaseWithDetails extends InspectionCase {
  statusColor: string;
  statusLabel: string;
  source: 'firebase' | 'cpanel';
}

// Calculate total price with VAT and discounts for a case
const calculateCaseTotal = (caseItem: CaseWithDetails): number => {
  // Calculate services subtotal
  const servicesSubtotal = (caseItem.services || []).reduce((sum, s) => {
    // Price from CPanel is already total price (unit_rate * count)
    return sum + (s.price || 0);
  }, 0);
  
  // Calculate parts subtotal
  const partsSubtotal = (caseItem.parts || []).reduce((sum: number, p: any) => {
    return sum + (p.totalPrice || (p.unitPrice * (p.quantity || 1)) || 0);
  }, 0);
  
  // Apply services discount
  const servicesDiscount = (caseItem.servicesDiscount || 0) / 100;
  const servicesTotal = servicesSubtotal * (1 - servicesDiscount);
  
  // Apply parts discount
  const partsDiscount = (caseItem.partsDiscount || 0) / 100;
  const partsTotal = partsSubtotal * (1 - partsDiscount);
  
  // Subtotal after item discounts
  const subtotal = servicesTotal + partsTotal;
  
  // Apply global discount
  const globalDiscount = (caseItem.globalDiscount || 0) / 100;
  const subtotalAfterGlobalDiscount = subtotal * (1 - globalDiscount);
  
  // Add VAT if enabled
  const vatAmount = caseItem.includeVAT ? subtotalAfterGlobalDiscount * 0.18 : 0;
  
  return subtotalAfterGlobalDiscount + vatAmount;
};

export default function CasesScreen() {
  const [cases, setCases] = useState<CaseWithDetails[]>([]);
  const [cpanelCases, setCpanelCases] = useState<CaseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [cpanelLoading, setCpanelLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'cost_high' | 'cost_low'>('newest');
  const [showSearch, setShowSearch] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'firebase' | 'cpanel'>('all');

  // Filter states
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'today' | 'recent' | 'old'>('all');
  const [priceRangeFilter, setPriceRangeFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [caseStatusFilter, setCaseStatusFilter] = useState<'all' | 'Pending' | 'In Progress' | 'In Service' | 'Completed'>('all');
  const [serviceFilterKey, setServiceFilterKey] = useState<string>('all');
  const [repairStatusFilter, setRepairStatusFilter] = useState<string>('all');
  const [workflowStatusFilter, setWorkflowStatusFilter] = useState<string>('all');

  // Scroll position preservation
  const flatListRef = useRef<FlatList>(null);
  const scrollOffsetRef = useRef<number>(0);
  const shouldRestoreScrollRef = useRef<boolean>(false);

  const loadCases = async () => {
    try {
      setLoading(true);
      const inspections = await getAllInspections();

      const casesWithDetails: CaseWithDetails[] = inspections.map((inspection: any) => ({
        id: inspection.id,
        customerName: inspection.customerName || 'N/A',
        customerPhone: inspection.customerPhone || 'N/A',
        carMake: inspection.carMake || '',
        carModel: inspection.carModel || 'Unknown',
        carMakeId: inspection.carMakeId || '',
        carModelId: inspection.carModelId || '',
        plate: inspection.plate || inspection.carModel || 'N/A',
        totalPrice: inspection.totalPrice || 0,
        services: inspection.services || [],
        parts: inspection.parts || [],
        status: inspection.status || 'Pending',
        repair_status: inspection.repair_status || null,
        createdAt: inspection.createdAt,
        updatedAt: inspection.updatedAt,
        cpanelInvoiceId: inspection.cpanelInvoiceId || '',
        statusColor: getStatusColor(inspection.createdAt),
        statusLabel: getStatusLabel(inspection.createdAt),
        source: 'firebase' as const,
        includeVAT: inspection.includeVAT || false,
        vatAmount: inspection.vatAmount || 0,
        servicesDiscount: inspection.services_discount_percent || 0,
        partsDiscount: inspection.parts_discount_percent || 0,
        globalDiscount: inspection.global_discount_percent || 0,
        assignedMechanic: inspection.assignedMechanic || null,
      }));

      setCases(casesWithDetails);
    } catch (error) {
      console.error('Error loading cases:', error);
      Alert.alert('Connection Error', 'Unable to load cases.');
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCpanelCases = async () => {
    try {
      setCpanelLoading(true);
      const result: any = await fetchAllCPanelInvoices({ limit: 200, onlyCPanelOnly: true });

      if (result.success && result.invoices) {
        const cpanelCasesWithDetails: CaseWithDetails[] = result.invoices.map((invoice: any) => ({
          id: invoice.cpanelId?.toString() || '',
          customerName: invoice.customerName || 'N/A',
          customerPhone: invoice.customerPhone || 'N/A',
          carMake: invoice.carMake || '',
          carModel: invoice.carModel || 'Unknown',
          carMakeId: '',
          carModelId: '',
          plate: invoice.plate || invoice.carModel || 'N/A',
          totalPrice: invoice.totalPrice || 0,
          services: invoice.services || [],
          parts: invoice.parts || [],
          status: invoice.status || 'New',
          repair_status: invoice.repair_status || null,
          createdAt: invoice.createdAt,
          updatedAt: invoice.updatedAt,
          cpanelInvoiceId: invoice.cpanelId?.toString() || '',
          statusColor: getStatusColor(invoice.createdAt),
          statusLabel: getStatusLabel(invoice.createdAt),
          source: 'cpanel' as const,
          includeVAT: invoice.includeVAT || false,
          vatAmount: invoice.vatAmount || 0,
          servicesDiscount: invoice.services_discount_percent || 0,
          partsDiscount: invoice.parts_discount_percent || 0,
          globalDiscount: invoice.global_discount_percent || 0,
          assignedMechanic: invoice.assigned_mechanic || invoice.assignedMechanic || null,
        }));

        setCpanelCases(cpanelCasesWithDetails);
      } else {
        setCpanelCases([]);
      }
    } catch (error) {
      console.error('Error loading cPanel cases:', error);
      setCpanelCases([]);
    } finally {
      setCpanelLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadCases(), loadCpanelCases()]);
    setRefreshing(false);
  };

  const handleDeleteCase = async (caseId: string, customerName: string) => {
    Alert.alert(
      '🗑️ წაშლა',
      `ნამდვილად წავშალოთ "${customerName}"?`,
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: 'წაშლა',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[Delete] Starting delete for caseId:', caseId);
              
              // Find the case to get cPanel invoice ID
              const caseToDelete = cases.find(c => c.id === caseId);
              let cpanelDeleted = false;
              let cpanelId: string | undefined = caseToDelete?.cpanelInvoiceId || undefined;
              
              console.log('[Delete] Case found:', caseToDelete ? 'yes' : 'no', 'cpanelId:', cpanelId);
              
              // Try to get cPanel ID if not stored locally
              if (!cpanelId) {
                try {
                  const { fetchCPanelInvoiceId } = await import('../../src/services/cpanelService');
                  const fetchedId = await fetchCPanelInvoiceId(caseId);
                  cpanelId = fetchedId || undefined;
                  console.log('[Delete] Fetched cPanel ID:', cpanelId);
                } catch (e) {
                  console.log('[Delete] Could not fetch cPanel ID:', e);
                }
              }
              
              // Delete from cPanel if ID exists
              if (cpanelId) {
                try {
                  const { deleteInvoiceFromCPanel } = await import('../../src/services/cpanelService');
                  const result = await deleteInvoiceFromCPanel(cpanelId) as { success: boolean; error?: string };
                  cpanelDeleted = result.success === true;
                  console.log('[Delete] cPanel delete result:', result);
                } catch (e) {
                  console.error('[Delete] cPanel delete error:', e);
                }
              }
              
              // Delete from Firebase - await and verify
              console.log('[Delete] Deleting from Firebase:', caseId);
              const { deleteInspection } = await import('../../src/services/firebase');
              await deleteInspection(caseId);
              console.log('[Delete] Firebase delete completed for:', caseId);
              
              // Remove from local state for immediate UI feedback
              setCases(prevCases => prevCases.filter(c => c.id !== caseId));
              
              if (cpanelId && cpanelDeleted) {
                Alert.alert('✅ წაშლილია', 'ინვოისი წაიშალა Firebase-დან და cPanel-დან');
              } else if (cpanelId && !cpanelDeleted) {
                Alert.alert('⚠️ ნაწილობრივ წაშლილია', 'ინვოისი წაიშალა Firebase-დან, მაგრამ cPanel-ში ვერ წაიშალა');
              } else {
                Alert.alert('✅ წაშლილია', 'ინვოისი წაიშალა Firebase-დან');
              }
            } catch (error: any) {
              console.error('[Delete] Error deleting case:', error);
              console.error('[Delete] Error message:', error?.message);
              console.error('[Delete] Error stack:', error?.stack);
              Alert.alert('❌ შეცდომა', `ინვოისის წაშლა ვერ მოხერხდა: ${error?.message || 'Unknown error'}`);
            }
          }
        }
      ]
    );
  };

  const handleSharePublicLink = async (item: CaseWithDetails) => {
    if (!item.cpanelInvoiceId) {
      Alert.alert('❌ შეცდომა', 'ინვოისი ჯერ არ არის სინქრონიზებული პორტალთან.');
      return;
    }

    try {
      // Fetch full invoice data to get the slug
      const invoiceData = await fetchInvoiceFromCPanel(item.cpanelInvoiceId);
      const slug = invoiceData?.slug;

      if (!slug) {
        Alert.alert('❌ შეცდომა', 'Slug not found for this invoice.');
        return;
      }

      const publicUrl = `https://portal.otoexpress.ge/public_invoice.php?slug=${slug}`;

      await Share.share({
        message: `📋 ინვოისი: ${item.customerName || 'მომხმარებელი'}\n🚗 ${item.plate || item.carModel || 'ავტომობილი'}\n💰 ჯამი: ${formatCurrencyGEL(calculateCaseTotal(item))}\n\n🔗 ლინკი: ${publicUrl}`,
        url: publicUrl,
        title: `ინვოისი #${item.id.slice(0, 8).toUpperCase()}`,
      });
    } catch (error: any) {
      console.error('Error sharing link:', error);
      Alert.alert('❌ შეცდომა', 'ლინკის გაზიარება ვერ მოხერხდა');
    }
  };

  const getServiceNameGeorgian = (serviceName: string): string => {
    if (!serviceName) return '';
    
    // First check by key
    const serviceKey = serviceName.toLowerCase().replace(/\s+/g, '_');
    if (DEFAULT_SERVICES[serviceKey as keyof typeof DEFAULT_SERVICES]) {
      return DEFAULT_SERVICES[serviceKey as keyof typeof DEFAULT_SERVICES].nameKa;
    }
    
    // Then check by English name
    for (const key of Object.keys(DEFAULT_SERVICES)) {
      const service = DEFAULT_SERVICES[key as keyof typeof DEFAULT_SERVICES];
      if (service.nameEn.toLowerCase() === serviceName.toLowerCase()) {
        return service.nameKa;
      }
    }
    return serviceName;
  };

  const normalizeService = (service: any) => {
    // Prioritize Georgian name over English
    const georgianName = service.serviceNameKa || service.nameKa || '';
    const englishName = service.serviceName || service.description || service.name || 'Unknown';
    
    return {
      serviceName: georgianName || getServiceNameGeorgian(englishName) || englishName,
      serviceNameKa: georgianName || getServiceNameGeorgian(englishName),
      serviceNameEn: englishName,
      price: service.price || service.hourly_rate || service.rate || 0,
      count: service.count || 1,
    };
  };

  // Load cases when screen comes into focus and restore scroll position
  useFocusEffect(
    useCallback(() => {
      // Only reload data if not restoring scroll position
      // This prevents data reload from resetting the list when going back
      if (!shouldRestoreScrollRef.current) {
        loadCases();
        loadCpanelCases();
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

  // Handle navigation to case detail - save scroll position
  const handleOpenCase = (item: CaseWithDetails) => {
    shouldRestoreScrollRef.current = true;
    router.push({ pathname: '/cases/[id]', params: { id: item.id, source: item.source } });
  };

  const getStatusColor = (createdAt: Date): string => {
    const daysSinceCreated = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceCreated <= 1) return COLORS.success;
    if (daysSinceCreated <= 7) return COLORS.warning;
    return COLORS.error;
  };

  const getStatusLabel = (createdAt: Date): string => {
    const daysSinceCreated = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceCreated === 0) return 'დღეს';
    if (daysSinceCreated === 1) return 'გუშინ';
    if (daysSinceCreated <= 7) return `${daysSinceCreated} დღის წინ`;
    if (daysSinceCreated <= 30) return `${Math.floor(daysSinceCreated / 7)} კვირის წინ`;
    return `${Math.floor(daysSinceCreated / 30)} თვის წინ`;
  };

  const filterAndSortCases = () => {
    // Combine both Firebase and cPanel cases
    const allCases = [...cases, ...cpanelCases];
    let filteredCases = allCases.filter(caseItem => {
      // Source filter
      if (sourceFilter !== 'all' && caseItem.source !== sourceFilter) return false;
      // Search filter - search across all relevant fields
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearch = !searchQuery || (
        (caseItem.id?.toLowerCase() || '').includes(searchLower) ||
        (caseItem.plate?.toLowerCase() || '').includes(searchLower) ||
        (caseItem.carMake?.toLowerCase() || '').includes(searchLower) ||
        (caseItem.carModel?.toLowerCase() || '').includes(searchLower) ||
        (caseItem.customerName?.toLowerCase() || '').includes(searchLower) ||
        (caseItem.customerPhone?.toLowerCase() || '').includes(searchLower) ||
        (caseItem.status?.toLowerCase() || '').includes(searchLower) ||
        (caseItem.repair_status?.toLowerCase() || '').includes(searchLower) ||
        (caseItem.assignedMechanic?.toLowerCase() || '').includes(searchLower) ||
        (String(caseItem.cpanelInvoiceId || '').toLowerCase()).includes(searchLower) ||
        (caseItem.services?.some(s => 
          (s.serviceName?.toLowerCase() || '').includes(searchLower) ||
          (s.key?.toLowerCase() || '').includes(searchLower)
        ) || false) ||
        (caseItem.parts?.some((p: any) => 
          (p.name?.toLowerCase() || '').includes(searchLower) ||
          (p.partName?.toLowerCase() || '').includes(searchLower)
        ) || false)
      );

      // Status filter (based on age)
      const daysSinceCreated = Math.floor((Date.now() - new Date(caseItem.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      const matchesStatus = statusFilter === 'all' || (
        (statusFilter === 'today' && daysSinceCreated <= 1) ||
        (statusFilter === 'recent' && daysSinceCreated > 1 && daysSinceCreated <= 7) ||
        (statusFilter === 'old' && daysSinceCreated > 7)
      );

      // Price range filter
      const caseTotal = calculateCaseTotal(caseItem);
      const matchesPriceRange = priceRangeFilter === 'all' || (
        (priceRangeFilter === 'low' && caseTotal < 200) ||
        (priceRangeFilter === 'medium' && caseTotal >= 200 && caseTotal < 500) ||
        (priceRangeFilter === 'high' && caseTotal >= 500)
      );

      // Date range filter
      const matchesDateRange = dateRangeFilter === 'all' || (
        (dateRangeFilter === 'today' && daysSinceCreated === 0) ||
        (dateRangeFilter === 'week' && daysSinceCreated <= 7) ||
        (dateRangeFilter === 'month' && daysSinceCreated <= 30)
      );

      // Case status filter
      const matchesCaseStatus = caseStatusFilter === 'all' || caseItem.status === caseStatusFilter;

      // Service category filter
      const matchesService = serviceFilterKey === 'all' ||
        (caseItem.services?.some(s => s.key === serviceFilterKey) || false);

      // Repair status filter
      const matchesRepairStatus = repairStatusFilter === 'all' ||
        (repairStatusFilter === 'none' ? !caseItem.repair_status : caseItem.repair_status === repairStatusFilter);

      // Workflow status filter (filters by status field)
      const matchesWorkflowStatus = workflowStatusFilter === 'all' ||
        (workflowStatusFilter === 'none' ? !caseItem.status : caseItem.status === workflowStatusFilter);

      return matchesSearch && matchesStatus && matchesPriceRange && matchesDateRange && matchesCaseStatus && matchesService && matchesRepairStatus && matchesWorkflowStatus;
    });

    // Sort cases
    filteredCases.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
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

  const renderCaseCard = ({ item }: { item: CaseWithDetails }) => (
    <TouchableOpacity
      onPress={() => handleOpenCase(item)}
      activeOpacity={0.7}
      style={styles.cardTouchable}
    >
      <Card style={styles.caseCard} mode="elevated">
        {/* Color accent based on age */}
        <View style={[styles.cardAccent, { backgroundColor: item.statusColor }]} />
        
        <Card.Content style={styles.cardContent}>
          {/* Top Row: Vehicle + Price */}
          <View style={styles.cardTopRow}>
            <View style={styles.vehicleInfo}>
              <View style={[styles.vehicleIcon, { backgroundColor: item.statusColor + '20' }]}>
                <MaterialCommunityIcons name="car" size={28} color={item.statusColor} />
              </View>
              <View style={styles.vehicleDetails}>
                <Text style={styles.vehicleModel} numberOfLines={1}>
                  {item.plate || 'No Plate'}
                </Text>
                {(item.carMake || item.carModel) && (
                  <Text style={styles.vehicleMakeModel} numberOfLines={1}>
                    {[item.carMake, item.carModel].filter(Boolean).join(' ')}
                  </Text>
                )}
                <Text style={styles.customerNameText} numberOfLines={1}>
                  {item.customerName}
                </Text>
              </View>
            </View>
            <View style={styles.priceContainer}>
              <View style={styles.priceRow}>
                <Text style={styles.priceValue}>{formatCurrencyGEL(calculateCaseTotal(item))}</Text>
                <View style={[
                  styles.sourceIndicator,
                  { backgroundColor: item.source === 'firebase' ? '#FEF3C7' : '#DBEAFE' }
                ]}>
                  <MaterialCommunityIcons
                    name={item.source === 'firebase' ? 'firebase' : 'server'}
                    size={14}
                    color={item.source === 'firebase' ? '#F59E0B' : '#3B82F6'}
                  />
                </View>
              </View>
              <Chip
                style={[styles.timeChip, { backgroundColor: item.statusColor + '20' }]}
                textStyle={[styles.timeChipText, { color: item.statusColor }]}
                compact
              >
                {item.statusLabel}
              </Chip>
            </View>
          </View>

          {/* Middle Row: Phone */}
          <View style={styles.phoneRow}>
            <MaterialCommunityIcons name="phone" size={18} color={COLORS.text.secondary} />
            <Text style={styles.phoneText}>{item.customerPhone}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{item.status}</Text>
            </View>
          </View>

          {/* Assigned Mechanic Row */}
          {item.assignedMechanic && (
            <View style={styles.mechanicRow}>
              <MaterialCommunityIcons name="account-wrench" size={16} color="#6366F1" />
              <Text style={styles.mechanicText}>{item.assignedMechanic}</Text>
            </View>
          )}

          {/* Services Row */}
          {item.services && item.services.length > 0 && (
            <View style={styles.servicesRow}>
              {item.services.slice(0, 2).map((service, index) => {
                const normalized = normalizeService(service);
                return (
                  <Chip
                    key={index}
                    mode="flat"
                    compact
                    style={styles.serviceChip}
                    textStyle={styles.serviceChipText}
                  >
                    {normalized.serviceNameKa || getServiceNameGeorgian(normalized.serviceName)}
                  </Chip>
                );
              })}
              {item.services.length > 2 && (
                <Chip mode="flat" compact style={styles.moreChip} textStyle={styles.moreChipText}>
                  +{item.services.length - 2}
                </Chip>
              )}
            </View>
          )}

          {/* Action Row - One-handed friendly at bottom */}
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.cardActionButton}
              onPress={() => {
                const cleanPhone = item.customerPhone.replace(/\D/g, '');
                const whatsappPhone = cleanPhone.startsWith('995') ? cleanPhone : `995${cleanPhone}`;
                Linking.openURL(`whatsapp://send?phone=${whatsappPhone}`);
              }}
            >
              <MaterialCommunityIcons name="whatsapp" size={24} color="#25D366" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardActionButton}
              onPress={() => Linking.openURL(`tel:${item.customerPhone}`)}
            >
              <MaterialCommunityIcons name="phone-outline" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cardActionButton, styles.shareAction]}
              onPress={() => handleSharePublicLink(item)}
            >
              <MaterialCommunityIcons name="share-variant" size={24} color={COLORS.success} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cardActionButton, styles.deleteAction]}
              onPress={() => handleDeleteCase(item.id, item.customerName || 'Customer')}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={24} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  const getSortLabel = () => {
    switch (sortBy) {
      case 'newest': return 'უახლესი';
      case 'oldest': return 'ძველი';
      case 'cost_high': return 'მაღალი';
      case 'cost_low': return 'დაბალი';
      default: return 'Sort';
    }
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (priceRangeFilter !== 'all') count++;
    if (dateRangeFilter !== 'all') count++;
    if (caseStatusFilter !== 'all') count++;
    if (serviceFilterKey !== 'all') count++;
    if (repairStatusFilter !== 'all') count++;
    if (workflowStatusFilter !== 'all') count++;
    return count;
  };

  const clearAllFilters = () => {
    setStatusFilter('all');
    setPriceRangeFilter('all');
    setDateRangeFilter('all');
    setCaseStatusFilter('all');
    setServiceFilterKey('all');
    setRepairStatusFilter('all');
    setWorkflowStatusFilter('all');
  };

  const hasActiveFilters = () => getActiveFilterCount() > 0;

  // Get unique services for filter dropdown
  const getAvailableServices = () => {
    const serviceMap = new Map();
    cases.forEach(caseItem => {
      caseItem.services?.forEach(service => {
        if (service.key && !serviceMap.has(service.key)) {
          serviceMap.set(service.key, service.serviceName);
        }
      });
    });
    return Array.from(serviceMap.entries()).map(([key, name]) => ({
      key,
      name,
      nameKa: getServiceNameGeorgian(name)
    })).sort((a, b) => a.nameKa.localeCompare(b.nameKa));
  };

  // Get unique case statuses for filter
  const getAvailableStatuses = () => {
    const statuses = new Set(cases.map(c => c.status).filter(Boolean));
    return Array.from(statuses) as ('Pending' | 'In Progress' | 'Completed')[];
  };

  // Get Georgian labels for filter options
  const getFilterLabel = (filterType: string, value: string): string => {
    const filterLabels: Record<string, Record<string, string>> = {
      status: {
        all: 'ყველა',
        today: 'დღეს',
        recent: 'ბოლო 7 დღე',
        old: '7+ დღე'
      },
      price: {
        all: 'ყველა',
        low: 'დაბალი (<₾200)',
        medium: 'საშუალო (₾200-500)',
        high: 'მაღალი (>₾500)'
      },
      date: {
        all: 'ყველა',
        today: 'დღეს',
        week: 'ამ კვირაში',
        month: 'ამ თვეში'
      },
      caseStatus: {
        all: 'ყველა',
        'Pending': 'მოლოდინში',
        'In Progress': 'მიმდინარე',
        'In Service': 'სერვისშია',
        'Completed': 'დასრულებული'
      },
      repairStatus: {
        all: 'ყველა',
        none: 'არ არის',
        'New': 'ახალი',
        'In Progress': 'მიმდინარე',
        'Completed': 'დასრულებული',
        'Cancelled': 'გაუქმებული'
      },
      workflowStatus: {
        all: 'ყველა',
        none: 'არ არის',
        'New': 'ახალი',
        'Processing': 'მუშავდება',
        'Contacted': 'დარეკილი',
        'Parts ordered': 'შეკვეთილია ნაწილები',
        'Parts Arrived': 'ჩამოსულია ნაწილები',
        'Scheduled': 'დაბარებული',
        'Completed': 'დასრულებული',
        'Issue': 'პრობლემა'
      }
    };
    return filterLabels[filterType]?.[value] || value;
  };

  // Repair status options for filter
  const repairStatusOptions = [
    { value: 'all', label: 'ყველა' },
    { value: 'none', label: 'არ არის' },
    { value: 'New', label: 'ახალი' },
    { value: 'In Progress', label: 'მიმდინარე' },
    { value: 'Completed', label: 'დასრულებული' },
    { value: 'Cancelled', label: 'გაუქმებული' },
  ];

  // Workflow status options for filter (case status from CPanel)
  const workflowStatusOptions = [
    { value: 'all', label: 'ყველა' },
    { value: 'none', label: 'არ არის' },
    { value: 'New', label: 'ახალი' },
    { value: 'Processing', label: 'მუშავდება' },
    { value: 'Contacted', label: 'დარეკილი' },
    { value: 'Parts ordered', label: 'შეკვეთილია ნაწილები' },
    { value: 'Parts Arrived', label: 'ჩამოსულია ნაწილები' },
    { value: 'Scheduled', label: 'დაბარებული' },
    { value: 'Completed', label: 'დასრულებული' },
    { value: 'Issue', label: 'პრობლემა' },
  ];

  // Get color for repair status
  const getRepairStatusColor = (status: string | null | undefined): string => {
    switch (status) {
      case 'New': return '#3B82F6';
      case 'In Progress': return '#F59E0B';
      case 'Completed': return '#10B981';
      case 'Cancelled': return '#EF4444';
      default: return '#94A3B8';
    }
  };

  // Get color for workflow status
  const getWorkflowStatusColor = (status: string | null | undefined): string => {
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

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>იტვირთება...</Text>
      </View>
    );
  }

  const filteredCases = filterAndSortCases();
  const totalValue = filteredCases.reduce((sum, item) => sum + calculateCaseTotal(item), 0);

  return (
    <View style={styles.container}>
      {/* Compact Header */}
      <Surface style={styles.header} elevation={2}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>საქმეები</Text>
          <View style={styles.headerActions}>
            <IconButton
              icon={showSearch ? "close" : "magnify"}
              size={24}
              onPress={() => setShowSearch(!showSearch)}
              iconColor={COLORS.text.primary}
            />
            <View>
              <IconButton
                icon="filter-variant"
                size={24}
                onPress={() => setShowFilterModal(true)}
                iconColor={hasActiveFilters() ? COLORS.primary : COLORS.text.primary}
              />
              {hasActiveFilters() && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{getActiveFilterCount()}</Text>
                </View>
              )}
            </View>
            <Menu
              visible={filterMenuVisible}
              onDismiss={() => setFilterMenuVisible(false)}
              anchor={
                <IconButton
                  icon="sort-variant"
                  size={24}
                  onPress={() => setFilterMenuVisible(true)}
                  iconColor={COLORS.text.primary}
                />
              }
            >
              <Menu.Item
                title="უახლესი"
                onPress={() => { setSortBy('newest'); setFilterMenuVisible(false); }}
                leadingIcon={sortBy === 'newest' ? 'check' : undefined}
              />
              <Menu.Item
                title="ძველი"
                onPress={() => { setSortBy('oldest'); setFilterMenuVisible(false); }}
                leadingIcon={sortBy === 'oldest' ? 'check' : undefined}
              />
              <Divider />
              <Menu.Item
                title="მაღალი ფასი"
                onPress={() => { setSortBy('cost_high'); setFilterMenuVisible(false); }}
                leadingIcon={sortBy === 'cost_high' ? 'check' : undefined}
              />
              <Menu.Item
                title="დაბალი ფასი"
                onPress={() => { setSortBy('cost_low'); setFilterMenuVisible(false); }}
                leadingIcon={sortBy === 'cost_low' ? 'check' : undefined}
              />
            </Menu>
          </View>
        </View>

        {/* Search - Collapsible */}
        {showSearch && (
          <Searchbar
            placeholder="ძიება..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            iconColor={COLORS.text.secondary}
          />
        )}

        {/* Source Filter Chips */}
        <View style={styles.sourceFilterContainer}>
          <TouchableOpacity
            style={[styles.sourceChip, sourceFilter === 'all' && styles.sourceChipActive]}
            onPress={() => setSourceFilter('all')}
          >
            <Text style={[styles.sourceChipText, sourceFilter === 'all' && styles.sourceChipTextActive]}>
              ყველა ({cases.length + cpanelCases.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sourceChip, sourceFilter === 'firebase' && styles.sourceChipActive]}
            onPress={() => setSourceFilter('firebase')}
          >
            <MaterialCommunityIcons
              name="firebase"
              size={16}
              color={sourceFilter === 'firebase' ? '#fff' : '#F59E0B'}
            />
            <Text style={[styles.sourceChipText, sourceFilter === 'firebase' && styles.sourceChipTextActive]}>
              {cases.length}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sourceChip, sourceFilter === 'cpanel' && styles.sourceChipActive]}
            onPress={() => setSourceFilter('cpanel')}
          >
            <MaterialCommunityIcons
              name="server"
              size={16}
              color={sourceFilter === 'cpanel' ? '#fff' : '#3B82F6'}
            />
            <Text style={[styles.sourceChipText, sourceFilter === 'cpanel' && styles.sourceChipTextActive]}>
              {cpanelCases.length}
            </Text>
            {cpanelLoading && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 4 }} />}
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{filteredCases.length}</Text>
            <Text style={styles.statLabel}>საქმე</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatCurrencyGEL(totalValue)}</Text>
            <Text style={styles.statLabel}>ჯამი</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Chip compact style={styles.sortChip} textStyle={styles.sortChipText}>
              {getSortLabel()}
            </Chip>
          </View>
        </View>
      </Surface>

      {/* Cases List */}
      {filteredCases.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="folder-open-outline" size={80} color={COLORS.text.disabled} />
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'არ მოიძებნა' : 'არ არის საქმეები'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery ? 'შეცვალეთ ძიების პარამეტრები' : 'დაამატეთ პირველი ავტომობილი'}
          </Text>
          {!searchQuery && (
            <Button
              mode="contained"
              onPress={() => router.push('/capture/QuickCaptureScreen')}
              style={styles.emptyButton}
              icon="camera-plus"
            >
              ახალი ავტო
            </Button>
          )}
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredCases}
          renderItem={renderCaseCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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

      {/* FAB - Bottom right for thumb reach */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/cases/create')}
        label="ახალი საქმე"
        color="#fff"
      />

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>ფილტრები</Text>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setShowFilterModal(false)}
              />
            </View>

            <ScrollView style={styles.filterModalContent} showsVerticalScrollIndicator={false}>
              {/* Repair Status Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>რემონტის სტატუსი</Text>
                <View style={styles.filterChipsRow}>
                  {repairStatusOptions.map((option) => (
                    <Chip
                      key={option.value}
                      mode={repairStatusFilter === option.value ? 'flat' : 'outlined'}
                      selected={repairStatusFilter === option.value}
                      onPress={() => setRepairStatusFilter(option.value)}
                      style={[
                        styles.filterChip,
                        repairStatusFilter === option.value && {
                          backgroundColor: getRepairStatusColor(option.value === 'all' || option.value === 'none' ? null : option.value) + '20'
                        }
                      ]}
                      textStyle={[
                        styles.filterChipText,
                        repairStatusFilter === option.value && {
                          color: getRepairStatusColor(option.value === 'all' || option.value === 'none' ? null : option.value)
                        }
                      ]}
                    >
                      {option.label}
                    </Chip>
                  ))}
                </View>
              </View>

              {/* Workflow Status Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>საქმის სტატუსი</Text>
                <View style={styles.filterChipsRow}>
                  {workflowStatusOptions.map((option) => (
                    <Chip
                      key={option.value}
                      mode={workflowStatusFilter === option.value ? 'flat' : 'outlined'}
                      selected={workflowStatusFilter === option.value}
                      onPress={() => setWorkflowStatusFilter(option.value)}
                      style={[
                        styles.filterChip,
                        workflowStatusFilter === option.value && {
                          backgroundColor: getWorkflowStatusColor(option.value === 'all' || option.value === 'none' ? null : option.value) + '20'
                        }
                      ]}
                      textStyle={[
                        styles.filterChipText,
                        workflowStatusFilter === option.value && {
                          color: getWorkflowStatusColor(option.value === 'all' || option.value === 'none' ? null : option.value)
                        }
                      ]}
                    >
                      {option.label}
                    </Chip>
                  ))}
                </View>
              </View>

              {/* Case Status Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>საქმის სტატუსი</Text>
                <View style={styles.filterChipsRow}>
                  {(['all', 'Pending', 'In Progress', 'In Service', 'Completed'] as const).map((status) => (
                    <Chip
                      key={status}
                      mode={caseStatusFilter === status ? 'flat' : 'outlined'}
                      selected={caseStatusFilter === status}
                      onPress={() => setCaseStatusFilter(status)}
                      style={[
                        styles.filterChip,
                        caseStatusFilter === status && styles.filterChipSelected
                      ]}
                      textStyle={[
                        styles.filterChipText,
                        caseStatusFilter === status && styles.filterChipTextSelected
                      ]}
                    >
                      {getFilterLabel('caseStatus', status)}
                    </Chip>
                  ))}
                </View>
              </View>

              {/* Age Status Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>ხანდაზმულობა</Text>
                <View style={styles.filterChipsRow}>
                  {(['all', 'today', 'recent', 'old'] as const).map((status) => (
                    <Chip
                      key={status}
                      mode={statusFilter === status ? 'flat' : 'outlined'}
                      selected={statusFilter === status}
                      onPress={() => setStatusFilter(status)}
                      style={[
                        styles.filterChip,
                        statusFilter === status && styles.filterChipSelected
                      ]}
                      textStyle={[
                        styles.filterChipText,
                        statusFilter === status && styles.filterChipTextSelected
                      ]}
                    >
                      {getFilterLabel('status', status)}
                    </Chip>
                  ))}
                </View>
              </View>

              {/* Price Range Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>ფასის დიაპაზონი</Text>
                <View style={styles.filterChipsRow}>
                  {(['all', 'low', 'medium', 'high'] as const).map((range) => (
                    <Chip
                      key={range}
                      mode={priceRangeFilter === range ? 'flat' : 'outlined'}
                      selected={priceRangeFilter === range}
                      onPress={() => setPriceRangeFilter(range)}
                      style={[
                        styles.filterChip,
                        priceRangeFilter === range && styles.filterChipSelected
                      ]}
                      textStyle={[
                        styles.filterChipText,
                        priceRangeFilter === range && styles.filterChipTextSelected
                      ]}
                    >
                      {getFilterLabel('price', range)}
                    </Chip>
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* Filter Modal Actions */}
            <View style={styles.filterModalActions}>
              <Button
                mode="outlined"
                onPress={clearAllFilters}
                style={styles.filterClearButton}
                disabled={!hasActiveFilters()}
              >
                გასუფთავება
              </Button>
              <Button
                mode="contained"
                onPress={() => setShowFilterModal(false)}
                style={styles.filterApplyButton}
              >
                მიღება ({filteredCases.length})
              </Button>
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
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.text.secondary,
    fontSize: 16,
  },
  
  // Header
  header: {
    backgroundColor: '#fff',
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.text.primary,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBar: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    elevation: 0,
    backgroundColor: '#F1F5F9',
    height: 48,
  },
  searchInput: {
    fontSize: 15,
    minHeight: 48,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  activeTabText: {
    color: COLORS.primary,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: COLORS.background,
    marginHorizontal: 20,
    borderRadius: 16,
    marginTop: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginTop: 4,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E2E8F0',
  },
  sortChip: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sortChipText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // List
  listContent: {
    padding: 20,
    paddingBottom: 120,
  },
  cardTouchable: {
    marginBottom: 16,
  },
  caseCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    elevation: 2,
  },
  cardAccent: {
    height: 6,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  cardContent: {
    padding: 20,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vehicleIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleDetails: {
    marginLeft: 14,
    flex: 1,
  },
  vehicleModel: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text.primary,
    letterSpacing: -0.2,
  },
  vehicleMakeModel: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginTop: 2,
    fontWeight: '500',
  },
  customerNameText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginTop: 4,
    fontWeight: '500',
  },
  priceContainer: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.3,
  },
  timeChip: {
    marginTop: 6,
    height: 28,
    paddingHorizontal: 10,
  },
  timeChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  phoneText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginLeft: 10,
    flex: 1,
    fontWeight: '500',
  },
  statusBadge: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  statusText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  mechanicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
    backgroundColor: '#6366F1' + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  mechanicText: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '600',
  },
  servicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  serviceChip: {
    backgroundColor: '#EEF2FF',
    height: 30,
    paddingHorizontal: 12,
  },
  serviceChipText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '600',
  },
  moreChip: {
    backgroundColor: '#F1F5F9',
    height: 30,
    paddingHorizontal: 12,
  },
  moreChipText: {
    fontSize: 12,
    color: COLORS.text.secondary,
    fontWeight: '600',
  },
  
  // Card Actions - Bottom for one-handed use
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 10,
  },
  cardActionButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareAction: {
    backgroundColor: '#F0FDF4',
  },
  deleteAction: {
    backgroundColor: '#FEF2F2',
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyButton: {
    marginTop: 24,
    borderRadius: 12,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 36,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  // Filter Badge
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // Filter Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  filterModalContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    marginBottom: 4,
  },
  filterChipSelected: {
    backgroundColor: COLORS.primary + '20',
  },
  filterChipText: {
    fontSize: 13,
  },
  filterChipTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  filterModalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  filterClearButton: {
    flex: 1,
    borderRadius: 12,
  },
  filterApplyButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  
  // Source Filter Chips
  sourceFilterContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    gap: 8,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  sourceChipActive: {
    backgroundColor: COLORS.primary,
  },
  sourceChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  sourceChipTextActive: {
    color: '#fff',
  },
  
  // Source Indicator in Card
  sourceIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});