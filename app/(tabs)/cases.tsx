import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
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
  createdAt: string;
  updatedAt: string;
  cpanelInvoiceId?: string;
}

interface CaseWithDetails extends InspectionCase {
  statusColor: string;
  statusLabel: string;
}

export default function CasesScreen() {
  const [cases, setCases] = useState<CaseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'cost_high' | 'cost_low'>('newest');
  const [showSearch, setShowSearch] = useState(false);

  // Filter states
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'today' | 'recent' | 'old'>('all');
  const [priceRangeFilter, setPriceRangeFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [caseStatusFilter, setCaseStatusFilter] = useState<'all' | 'Pending' | 'In Progress' | 'Completed'>('all');
  const [serviceFilterKey, setServiceFilterKey] = useState<string>('all');

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
        createdAt: inspection.createdAt,
        updatedAt: inspection.updatedAt,
        cpanelInvoiceId: inspection.cpanelInvoiceId || '',
        statusColor: getStatusColor(inspection.createdAt),
        statusLabel: getStatusLabel(inspection.createdAt),
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCases();
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
              // Find the case to get cPanel invoice ID
              const caseToDelete = cases.find(c => c.id === caseId);
              let cpanelDeleted = false;
              let cpanelId: string | undefined = caseToDelete?.cpanelInvoiceId || undefined;
              
              // Try to get cPanel ID if not stored locally
              if (!cpanelId) {
                try {
                  const { fetchCPanelInvoiceId } = await import('../../src/services/cpanelService');
                  const fetchedId = await fetchCPanelInvoiceId(caseId);
                  cpanelId = fetchedId || undefined;
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
              
              // Delete from Firebase
              const { deleteInspection } = await import('../../src/services/firebase');
              await deleteInspection(caseId);
              console.log('[Delete] Firebase delete successful:', caseId);
              
              // Remove from local state for immediate UI feedback
              setCases(prevCases => prevCases.filter(c => c.id !== caseId));
              
              if (cpanelId && cpanelDeleted) {
                Alert.alert('✅ წაშლილია', 'ინვოისი წაიშალა Firebase-დან და cPanel-დან');
              } else if (cpanelId && !cpanelDeleted) {
                Alert.alert('⚠️ ნაწილობრივ წაშლილია', 'ინვოისი წაიშალა Firebase-დან, მაგრამ cPanel-ში ვერ წაიშალა');
              } else {
                Alert.alert('✅ წაშლილია', 'ინვოისი წაიშალა Firebase-დან');
              }
            } catch (error) {
              console.error('Error deleting case:', error);
              Alert.alert('❌ შეცდომა', 'ინვოისის წაშლა ვერ მოხერხდა');
            }
          }
        }
      ]
    );
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

  const normalizeService = (service: any) => {
    return {
      serviceName: service.serviceName || service.description || service.name || 'Unknown',
      serviceNameKa: service.serviceNameKa || service.nameKa || '',
      price: service.price || service.hourly_rate || service.rate || 0,
      count: service.count || 1,
    };
  };

  // Load cases when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadCases();
    }, [])
  );

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
    let filteredCases = cases.filter(caseItem => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || (
        (caseItem.plate?.toLowerCase() || '').includes(searchLower) ||
        (caseItem.carModel?.toLowerCase() || '').includes(searchLower) ||
        (caseItem.customerName?.toLowerCase() || '').includes(searchLower) ||
        (caseItem.customerPhone?.toLowerCase() || '').includes(searchLower) ||
        (caseItem.services?.some(s => s.serviceName.toLowerCase().includes(searchLower)) || false)
      );

      // Status filter (based on age)
      const daysSinceCreated = Math.floor((Date.now() - new Date(caseItem.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      const matchesStatus = statusFilter === 'all' || (
        (statusFilter === 'today' && daysSinceCreated <= 1) ||
        (statusFilter === 'recent' && daysSinceCreated > 1 && daysSinceCreated <= 7) ||
        (statusFilter === 'old' && daysSinceCreated > 7)
      );

      // Price range filter
      const matchesPriceRange = priceRangeFilter === 'all' || (
        (priceRangeFilter === 'low' && caseItem.totalPrice < 200) ||
        (priceRangeFilter === 'medium' && caseItem.totalPrice >= 200 && caseItem.totalPrice < 500) ||
        (priceRangeFilter === 'high' && caseItem.totalPrice >= 500)
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

      return matchesSearch && matchesStatus && matchesPriceRange && matchesDateRange && matchesCaseStatus && matchesService;
    });

    // Sort cases
    filteredCases.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'cost_high':
          return b.totalPrice - a.totalPrice;
        case 'cost_low':
          return a.totalPrice - b.totalPrice;
        default:
          return 0;
      }
    });

    return filteredCases;
  };

  const renderCaseCard = ({ item }: { item: CaseWithDetails }) => (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/cases/[id]', params: { id: item.id } })}
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
              <Text style={styles.priceValue}>{formatCurrencyGEL(item.totalPrice)}</Text>
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
    return count;
  };

  const clearAllFilters = () => {
    setStatusFilter('all');
    setPriceRangeFilter('all');
    setDateRangeFilter('all');
    setCaseStatusFilter('all');
    setServiceFilterKey('all');
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
        'Completed': 'დასრულებული'
      }
    };
    return filterLabels[filterType]?.[value] || value;
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
  const totalValue = filteredCases.reduce((sum, item) => sum + item.totalPrice, 0);

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
          data={filteredCases}
          renderItem={renderCaseCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
        icon="camera-plus"
        style={styles.fab}
        onPress={() => router.push('/capture/QuickCaptureScreen')}
        label="ახალი"
        color="#fff"
      />
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
});