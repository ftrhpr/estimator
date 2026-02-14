import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    DimensionValue,
    FlatList,
    Linking,
    Modal,
    RefreshControl,
    ScrollView,
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
import { formatCurrencyGEL } from '../../src/utils/helpers';

const { width } = Dimensions.get('window');
const GRID_CARD_WIDTH = (width - 48) / 2; // 2 columns with spacing

type ViewMode = 'list' | 'grid';
type RepairFilterValue = 'all' | string;

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
  assignedMechanic?: string | null;
}

interface CaseWithDetails extends InspectionCase {
  statusColor: string;
  statusLabel: string;
  source: 'firebase' | 'cpanel';
  daysInService: number;
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

export default function ServiceCasesScreen() {
  const [cases, setCases] = useState<CaseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'days_high' | 'days_low' | 'cost_high' | 'cost_low'>('days_high');
  const [statusFilter, setStatusFilter] = useState<'all' | 'In Service' | 'Already in service'>('all');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  
  // View mode & advanced filters
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [repairStatusFilter, setRepairStatusFilter] = useState<RepairFilterValue>('all');
  const [mechanicFilter, setMechanicFilter] = useState<string>('all');
  const [showFilterBar, setShowFilterBar] = useState(true);
  
  // Repair status modal states
  const [showRepairStatusModal, setShowRepairStatusModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseWithDetails | null>(null);
  const [savingRepairStatus, setSavingRepairStatus] = useState(false);
  
  // Worksheet modal states
  const [showWorksheetModal, setShowWorksheetModal] = useState(false);
  const [worksheetCase, setWorksheetCase] = useState<CaseWithDetails | null>(null);

  // Repair status options - each stage has a unique color and step index for progress tracking
  const repairStatusOptions = [
    { value: null, label: 'არ არის', icon: 'minus-circle-outline', color: '#94A3B8', step: 0 },
    { value: 'მზადაა დასაწყებად', label: 'მზადაა დასაწყებად', icon: 'clipboard-check-outline', color: '#6366F1', step: 1 },
    { value: 'იშლება', label: 'იშლება', icon: 'car-off', color: '#EF4444', step: 2 },
    { value: 'თუნუქი', label: 'თუნუქი', icon: 'spray', color: '#F97316', step: 3 },
    { value: 'პლასტმასის აღდგენა', label: 'პლასტმასის აღდგენა', icon: 'hammer-wrench', color: '#EC4899', step: 4 },
    { value: 'იღებება', label: 'იღებება', icon: 'format-paint', color: '#3B82F6', step: 5 },
    { value: 'მუშავდება', label: 'მუშავდება', icon: 'progress-wrench', color: '#7C3AED', step: 6 },
    { value: 'იღებება (საბოლოო)', label: 'იღებება (საბოლოო)', icon: 'format-paint', color: '#0891B2', step: 7 },
    { value: 'აწყობა', label: 'აწყობა', icon: 'car-cog', color: '#0EA5E9', step: 8 },
    { value: 'პოლირება', label: 'პოლირება', icon: 'shimmer', color: '#F59E0B', step: 9 },
    { value: 'დაშლილი და გასული', label: 'დაშლილი და გასული', icon: 'check-circle', color: '#059669', step: 10 },
    { value: 'ნაწილს ელოდება', label: 'ნაწილს ელოდება', icon: 'clock-alert-outline', color: '#64748B', step: 11 },
  ];

  const getRepairStatusColor = (status: string | null | undefined): string => {
    const option = repairStatusOptions.find(opt => opt.value === status);
    return option?.color || '#94A3B8';
  };

  const getRepairStatusLabel = (status: string | null | undefined): string => {
    if (!status) return 'არ არის';
    const option = repairStatusOptions.find(opt => opt.value === status);
    return option?.label || status;
  };

  const getRepairStatusIcon = (status: string | null | undefined): string => {
    const option = repairStatusOptions.find(opt => opt.value === status);
    return option?.icon || 'minus-circle-outline';
  };

  const getCurrentStep = (status: string | null | undefined): number => {
    const option = repairStatusOptions.find(opt => opt.value === status);
    return option?.step ?? 0;
  };

  const getRepairProgress = (status: string | null | undefined): number => {
    const step = getCurrentStep(status);
    const maxStep = repairStatusOptions.length - 1;
    return maxStep > 0 ? Math.round((step / maxStep) * 100) : 0;
  };

  const getNextRepairStatus = (status: string | null | undefined) => {
    const currentStep = getCurrentStep(status);
    return repairStatusOptions.find(opt => opt.step === currentStep + 1) || null;
  };

  const loadServiceCases = async () => {
    try {
      setLoading(true);
      
      // Load from Firebase - include "In Service" and "Already in service" statuses or status_id 7
      const inspections = await getAllInspections();
      const serviceStatuses = ['In Service', 'Already in service'];
      const SERVICE_STATUS_ID = 7; // Status ID for "In Service"
      const completedStatuses = ['Completed', 'completed', 'დასრულებული', 'COMPLETED'];
      const firebaseCases: CaseWithDetails[] = inspections
        .filter((inspection: any) => {
          // Never show completed cases in the service tab
          if (completedStatuses.includes(inspection.status)) return false;
          return (
            serviceStatuses.includes(inspection.status) || 
            inspection.status_id === SERVICE_STATUS_ID ||
            inspection.statusId === SERVICE_STATUS_ID
          );
        })
        .map((inspection: any) => {
          // Use statusChangedAt (when case entered "In Service") for accurate days count
          const serviceDate = inspection.statusChangedAt || inspection.status_changed_at || inspection.updatedAt || inspection.createdAt;
          const daysInService = Math.floor((Date.now() - new Date(serviceDate).getTime()) / (1000 * 60 * 60 * 24));
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
            status: inspection.status || 'Pending',
            repair_status: inspection.repair_status || null,
            createdAt: inspection.createdAt,
            updatedAt: inspection.updatedAt,
            cpanelInvoiceId: inspection.cpanelInvoiceId || '',
            statusColor: getStatusColor(serviceDate),
            statusLabel: getStatusLabel(serviceDate),
            source: 'firebase' as const,
            includeVAT: inspection.includeVAT || false,
            vatAmount: inspection.vatAmount || 0,
            servicesDiscount: inspection.services_discount_percent || 0,
            partsDiscount: inspection.parts_discount_percent || 0,
            globalDiscount: inspection.global_discount_percent || 0,
            daysInService,
            assignedMechanic: inspection.assignedMechanic || null,
          };
        });

      // Load from CPanel - get ALL cases (not just cPanel-only) to ensure we see all status_id=7 cases
      let cpanelServiceCases: CaseWithDetails[] = [];
      try {
        const result: any = await fetchAllCPanelInvoices({ limit: 500 });
        if (result.success && result.invoices) {
          // Debug: log all invoices with their status_id
          const statusId7Cases = result.invoices.filter((i: any) => {
            const statusId = parseInt(i.status_id) || parseInt(i.statusId) || 0;
            return statusId === SERVICE_STATUS_ID;
          });
          console.log('[Service] CPanel invoices with status_id 7:', statusId7Cases.length);
          console.log('[Service] Sample status_ids:', result.invoices.slice(0, 5).map((i: any) => ({ id: i.cpanelId, status_id: i.status_id, statusId: i.statusId })));
          
          const completedStatusTexts = ['Completed', 'completed', 'დასრულებული', 'COMPLETED'];
          cpanelServiceCases = result.invoices
            .filter((invoice: any) => {
              // Never show completed cases in the service tab
              if (completedStatusTexts.includes(invoice.status)) return false;
              // Parse status_id to handle both string and number values
              const statusId = parseInt(invoice.status_id) || parseInt(invoice.statusId) || 0;
              return statusId === SERVICE_STATUS_ID;
            })
            .map((invoice: any) => {
              // Use statusChangedAt (when case entered "In Service") for accurate days count
              const serviceDate = invoice.statusChangedAt || invoice.status_changed_at || invoice.updatedAt || invoice.createdAt;
              const daysInService = Math.floor((Date.now() - new Date(serviceDate).getTime()) / (1000 * 60 * 60 * 24));
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
                status: invoice.status || 'New',
                repair_status: invoice.repair_status || null,
                createdAt: invoice.createdAt,
                updatedAt: invoice.updatedAt,
                cpanelInvoiceId: invoice.cpanelId?.toString() || '',
                statusColor: getStatusColor(serviceDate),
                statusLabel: getStatusLabel(serviceDate),
                source: 'cpanel' as const,
                includeVAT: invoice.includeVAT || false,
                vatAmount: invoice.vatAmount || 0,
                servicesDiscount: invoice.services_discount_percent || 0,
                partsDiscount: invoice.parts_discount_percent || 0,
                globalDiscount: invoice.global_discount_percent || 0,
                daysInService,
                assignedMechanic: invoice.assigned_mechanic || invoice.assignedMechanic || null,
              };
            });
        }
      } catch (error) {
        console.error('Error loading cPanel service cases:', error);
      }

      // Use cPanel as primary source (has accurate status_id)
      // Deduplicate by cpanelInvoiceId AND plate number to avoid showing same case twice
      const cpanelIds = new Set(cpanelServiceCases.map(c => c.cpanelInvoiceId));
      const cpanelPlates = new Set(cpanelServiceCases.map(c => c.plate?.toUpperCase()).filter(Boolean));
      
      const uniqueFirebaseCases = firebaseCases.filter(fc => {
        // Skip if this Firebase case is already in cPanel (by cpanelInvoiceId)
        if (fc.cpanelInvoiceId && cpanelIds.has(fc.cpanelInvoiceId)) {
          return false;
        }
        // Skip if same plate already exists in cPanel
        if (fc.plate && cpanelPlates.has(fc.plate.toUpperCase())) {
          return false;
        }
        return true;
      });
      
      // Combine: cPanel cases first (authoritative), then unique Firebase cases
      const allServiceCases = [...cpanelServiceCases, ...uniqueFirebaseCases];
      allServiceCases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      console.log('[Service] Total cases:', allServiceCases.length, '(cPanel:', cpanelServiceCases.length, ', Firebase unique:', uniqueFirebaseCases.length, ')');
      
      setCases(allServiceCases);
    } catch (error) {
      console.error('Error loading service cases:', error);
      Alert.alert('კავშირის შეცდომა', 'სერვისის შემთხვევების ჩატვირთვა ვერ მოხერხდა.');
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadServiceCases();
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

  // Helper: reload data then restore scroll to where user was
  const reloadAndKeepScroll = async () => {
    const savedOffset = scrollOffsetRef.current;
    await loadServiceCases();
    if (savedOffset > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: savedOffset, animated: false });
      }, 80);
    }
  };

  useFocusEffect(
    useCallback(() => {
      // Only reload data if not restoring scroll position
      if (!shouldRestoreScrollRef.current) {
        loadServiceCases();
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

  const getDaysInServiceColor = (days: number): string => {
    if (days <= 2) return COLORS.success;
    if (days <= 5) return COLORS.warning;
    return COLORS.error;
  };

  const getDaysInServiceLabel = (days: number): string => {
    if (days === 0) return 'დღეს';
    if (days === 1) return '1 დღე';
    return `${days} დღე`;
  };

  // Extract unique mechanic names for filter
  const getUniqueMechanics = (): string[] => {
    const mechanics = new Set<string>();
    cases.forEach(c => {
      if (c.assignedMechanic) mechanics.add(c.assignedMechanic);
    });
    return Array.from(mechanics).sort();
  };

  // Count cases per repair status for filter badges
  const getRepairStatusCounts = (): Record<string, number> => {
    const counts: Record<string, number> = { all: cases.length };
    repairStatusOptions.forEach(opt => {
      const key = opt.value || '__none__';
      counts[key] = cases.filter(c => {
        if (opt.value === null) return !c.repair_status;
        return c.repair_status === opt.value;
      }).length;
    });
    return counts;
  };

  // Count active filters
  const getActiveFilterCount = (): number => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (repairStatusFilter !== 'all') count++;
    if (mechanicFilter !== 'all') count++;
    if (searchQuery) count++;
    return count;
  };

  // Clear all filters
  const clearAllFilters = () => {
    setStatusFilter('all');
    setRepairStatusFilter('all');
    setMechanicFilter('all');
    setSearchQuery('');
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
          (caseItem.customerName?.toLowerCase() || '').includes(searchLower) ||
          (caseItem.customerPhone?.toLowerCase() || '').includes(searchLower) ||
          (caseItem.assignedMechanic?.toLowerCase() || '').includes(searchLower) ||
          (caseItem.services?.some(s => s.serviceName.toLowerCase().includes(searchLower)) || false)
        );
      });
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filteredCases = filteredCases.filter(c => c.status === statusFilter);
    }

    // Filter by repair status
    if (repairStatusFilter !== 'all') {
      if (repairStatusFilter === '__none__') {
        filteredCases = filteredCases.filter(c => !c.repair_status);
      } else {
        filteredCases = filteredCases.filter(c => c.repair_status === repairStatusFilter);
      }
    }

    // Filter by mechanic
    if (mechanicFilter !== 'all') {
      if (mechanicFilter === '__unassigned__') {
        filteredCases = filteredCases.filter(c => !c.assignedMechanic);
      } else {
        filteredCases = filteredCases.filter(c => c.assignedMechanic === mechanicFilter);
      }
    }

    // Sort cases
    filteredCases.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'days_high':
          return b.daysInService - a.daysInService;
        case 'days_low':
          return a.daysInService - b.daysInService;
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

  const handleMarkComplete = async (item: CaseWithDetails) => {
    Alert.alert(
      '✅ დასრულება',
      `დარწმუნებული ხართ, რომ "${item.plate || item.carModel}" სერვისი დასრულდა?`,
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: 'დასრულება',
          onPress: async () => {
            try {
              const updateData = {
                status: 'Completed',
                status_id: null,
                updatedAt: new Date().toISOString(),
              };

              // For CPanel-only cases, only update CPanel
              if (item.source === 'cpanel') {
                const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
                await updateInvoiceToCPanel(item.cpanelInvoiceId, updateData);
              } else {
                // For Firebase cases, update Firebase (and CPanel if linked)
                const { updateInspection } = require('../../src/services/firebase');
                await updateInspection(item.id, updateData, item.cpanelInvoiceId || undefined);
              }
              
              Alert.alert('✅ წარმატებული', 'სერვისი დასრულებულად მონიშნულია');
              reloadAndKeepScroll();
            } catch (error) {
              console.error('Error marking complete:', error);
              Alert.alert('❌ შეცდომა', 'სტატუსის შეცვლა ვერ მოხერხდა');
            }
          }
        }
      ]
    );
  };

  // Generate worksheet text for technicians (without prices)
  const generateWorksheetText = (item: CaseWithDetails): string => {
    const currentDate = new Date().toLocaleDateString('ka-GE');
    const lines: string[] = [];
    
    lines.push('═══════════════════════════════════');
    lines.push('     სამუშაო ფურცელი / WORKSHEET');
    lines.push('═══════════════════════════════════');
    lines.push('');
    lines.push(`📅 თარიღი: ${currentDate}`);
    lines.push('');
    lines.push('───────────────────────────────────');
    lines.push('🚗 ავტომობილის ინფორმაცია:');
    lines.push('───────────────────────────────────');
    lines.push(`   ნომერი: ${item.plate || 'N/A'}`);
    if (item.carMake || item.carModel) {
      lines.push(`   მარკა/მოდელი: ${[item.carMake, item.carModel].filter(Boolean).join(' ')}`);
    }
    lines.push(`   სტატუსი: ${item.status === 'In Service' ? 'სერვისშია' : 'უკვე სერვისში'}`);
    if (item.repair_status) {
      lines.push(`   რემონტის ეტაპი: ${getRepairStatusLabel(item.repair_status)}`);
    }
    lines.push(`   სერვისში დღეები: ${item.daysInService}`);
    lines.push('');
    lines.push('───────────────────────────────────');
    lines.push('👤 კლიენტი:');
    lines.push('───────────────────────────────────');
    lines.push(`   სახელი: ${item.customerName || 'N/A'}`);
    lines.push(`   ტელეფონი: ${item.customerPhone || 'N/A'}`);
    lines.push('');
    lines.push('═══════════════════════════════════');
    lines.push('📋 შესასრულებელი სამუშაოები:');
    lines.push('═══════════════════════════════════');
    
    if (item.services && item.services.length > 0) {
      item.services.forEach((service, index) => {
        const normalized = normalizeService(service);
        lines.push('');
        lines.push(`  ${index + 1}. ☐ ${normalized.serviceName}`);
        if (normalized.count > 1) {
          lines.push(`       რაოდენობა: ${normalized.count}`);
        }
      });
    } else {
      lines.push('');
      lines.push('   სერვისები არ არის მითითებული');
    }
    
    if (item.parts && item.parts.length > 0) {
      lines.push('');
      lines.push('───────────────────────────────────');
      lines.push('🔧 საჭირო ნაწილები:');
      lines.push('───────────────────────────────────');
      item.parts.forEach((part, index) => {
        const partName = part.name || part.partName || 'ნაწილი';
        const qty = part.quantity || 1;
        lines.push(`  ${index + 1}. ☐ ${partName} (x${qty})`);
      });
    }
    
    lines.push('');
    lines.push('═══════════════════════════════════');
    lines.push('📝 შენიშვნები:');
    lines.push('───────────────────────────────────');
    lines.push('');
    lines.push('');
    lines.push('');
    lines.push('───────────────────────────────────');
    lines.push('✍️  ტექნიკოსის ხელმოწერა: ___________');
    lines.push('');
    lines.push('═══════════════════════════════════');
    
    return lines.join('\n');
  };

  // Generate HTML for PDF worksheet
  const generateWorksheetHTML = (item: CaseWithDetails): string => {
    const currentDate = new Date().toLocaleDateString('ka-GE');
    
    const servicesHTML = item.services && item.services.length > 0
      ? item.services.map((service, index) => {
          const normalized = normalizeService(service);
          return `
            <tr>
              <td style="width: 40px; text-align: center; vertical-align: top;">
                <span style="font-size: 18px;">☐</span>
              </td>
              <td style="padding: 8px 0;">
                <strong>${index + 1}. ${normalized.serviceName}</strong>
                ${normalized.count > 1 ? `<br/><span style="color: #666; font-size: 12px;">რაოდენობა: ${normalized.count}</span>` : ''}
              </td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="2" style="color: #999; font-style: italic; padding: 10px;">სერვისები არ არის მითითებული</td></tr>';

    const partsHTML = item.parts && item.parts.length > 0
      ? `
        <div style="margin-top: 20px;">
          <h3 style="color: #333; border-bottom: 2px solid #ddd; padding-bottom: 8px;">🔧 საჭირო ნაწილები</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${item.parts.map((part, index) => {
              const partName = part.name || part.partName || 'ნაწილი';
              const qty = part.quantity || 1;
              return `
                <tr>
                  <td style="width: 40px; text-align: center; vertical-align: top;">
                    <span style="font-size: 18px;">☐</span>
                  </td>
                  <td style="padding: 8px 0;">
                    <strong>${index + 1}. ${partName}</strong>
                    <br/><span style="color: #666; font-size: 12px;">რაოდენობა: ${qty}</span>
                  </td>
                </tr>
              `;
            }).join('')}
          </table>
        </div>
      `
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @page {
            margin: 20mm;
          }
          body {
            font-family: Arial, sans-serif;
            font-size: 14px;
            color: #333;
            line-height: 1.5;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #2196F3;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .header h1 {
            color: #2196F3;
            margin: 0;
            font-size: 24px;
          }
          .header .date {
            color: #666;
            font-size: 12px;
            margin-top: 5px;
          }
          .section {
            margin-bottom: 20px;
            background: #f9f9f9;
            padding: 15px;
            border-radius: 8px;
          }
          .section h3 {
            margin: 0 0 10px 0;
            color: #333;
            border-bottom: 2px solid #ddd;
            padding-bottom: 8px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px solid #eee;
          }
          .info-label {
            color: #666;
          }
          .info-value {
            font-weight: bold;
          }
          .services-table {
            width: 100%;
            border-collapse: collapse;
          }
          .services-table tr {
            border-bottom: 1px solid #eee;
          }
          .notes-section {
            margin-top: 30px;
            border: 2px dashed #ccc;
            padding: 15px;
            min-height: 100px;
            border-radius: 8px;
          }
          .notes-section h3 {
            margin: 0 0 10px 0;
            color: #666;
          }
          .signature-section {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
          }
          .signature-box {
            width: 45%;
          }
          .signature-line {
            border-top: 1px solid #333;
            margin-top: 50px;
            padding-top: 5px;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📋 სამუშაო ფურცელი / WORKSHEET</h1>
          <div class="date">📅 თარიღი: ${currentDate}</div>
        </div>

        <div class="section">
          <h3>🚗 ავტომობილის ინფორმაცია</h3>
          <div class="info-row">
            <span class="info-label">ნომერი:</span>
            <span class="info-value">${item.plate || 'N/A'}</span>
          </div>
          ${(item.carMake || item.carModel) ? `
            <div class="info-row">
              <span class="info-label">მარკა/მოდელი:</span>
              <span class="info-value">${[item.carMake, item.carModel].filter(Boolean).join(' ')}</span>
            </div>
          ` : ''}
          <div class="info-row">
            <span class="info-label">სტატუსი:</span>
            <span class="info-value">${item.status === 'In Service' ? 'სერვისშია' : 'უკვე სერვისში'}</span>
          </div>
          ${item.repair_status ? `
            <div class="info-row">
              <span class="info-label">რემონტის ეტაპი:</span>
              <span class="info-value">${getRepairStatusLabel(item.repair_status)}</span>
            </div>
          ` : ''}
          <div class="info-row">
            <span class="info-label">სერვისში დღეები:</span>
            <span class="info-value">${item.daysInService}</span>
          </div>
        </div>

        <div class="section">
          <h3>👤 კლიენტი</h3>
          <div class="info-row">
            <span class="info-label">სახელი:</span>
            <span class="info-value">${item.customerName || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">ტელეფონი:</span>
            <span class="info-value">${item.customerPhone || 'N/A'}</span>
          </div>
        </div>

        <div class="section">
          <h3>📋 შესასრულებელი სამუშაოები</h3>
          <table class="services-table">
            ${servicesHTML}
          </table>
        </div>

        ${partsHTML}

        <div class="notes-section">
          <h3>📝 შენიშვნები</h3>
          <p style="color: #999; font-style: italic;">ტექნიკოსის შენიშვნები...</p>
        </div>

        <div class="signature-section">
          <div class="signature-box">
            <div class="signature-line">ტექნიკოსის ხელმოწერა</div>
          </div>
          <div class="signature-box">
            <div class="signature-line">თარიღი</div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrintWorksheet = async (item: CaseWithDetails) => {
    try {
      const html = generateWorksheetHTML(item);
      
      // Print directly
      await Print.printAsync({
        html: html,
      });
    } catch (error) {
      console.error('Error printing worksheet:', error);
      Alert.alert('შეცდომა', 'ბეჭდვა ვერ მოხერხდა');
    }
  };

  const handleShareWorksheetPDF = async (item: CaseWithDetails) => {
    try {
      const html = generateWorksheetHTML(item);
      
      // Generate PDF file
      const { uri } = await Print.printToFileAsync({
        html: html,
        base64: false,
      });
      
      // Share the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `სამუშაო ფურცელი - ${item.plate || item.carModel}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('შეცდომა', 'გაზიარება არ არის ხელმისაწვდომი');
      }
    } catch (error) {
      console.error('Error sharing PDF:', error);
      Alert.alert('შეცდომა', 'PDF-ის შექმნა ვერ მოხერხდა');
    }
  };

  const handleOpenWorksheetPreview = (item: CaseWithDetails) => {
    setWorksheetCase(item);
    setShowWorksheetModal(true);
  };

  const handleOpenRepairStatusModal = (item: CaseWithDetails) => {
    setSelectedCase(item);
    setShowRepairStatusModal(true);
  };

  const handleSaveRepairStatus = async (newStatus: string | null, targetCase?: CaseWithDetails) => {
    const caseToUpdate = targetCase || selectedCase;
    if (!caseToUpdate) return;
    
    try {
      setSavingRepairStatus(true);
      
      const updateData = {
        repair_status: newStatus,
        updatedAt: new Date().toISOString(),
      };

      // Update CPanel if we have ID
      if (caseToUpdate.cpanelInvoiceId) {
        const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
        await updateInvoiceToCPanel(caseToUpdate.cpanelInvoiceId, updateData);
      }

      // Update Firebase if not CPanel-only
      if (caseToUpdate.source !== 'cpanel') {
        const { updateInspection } = require('../../src/services/firebase');
        await updateInspection(caseToUpdate.id, updateData, caseToUpdate.cpanelInvoiceId || undefined);
      }

      setShowRepairStatusModal(false);
      setSelectedCase(null);

      // Update local state in-place so FlatList doesn't re-mount (preserves scroll)
      setCases(prev =>
        prev.map(c =>
          (c.id === caseToUpdate.id && c.source === caseToUpdate.source)
            ? { ...c, repair_status: newStatus }
            : c
        )
      );
    } catch (error) {
      console.error('Error saving repair status:', error);
      Alert.alert('❌ შეცდომა', 'სტატუსის განახლება ვერ მოხერხდა');
    } finally {
      setSavingRepairStatus(false);
    }
  };

  const getStatistics = () => {
    const filteredCases = filterAndSortCases();
    // All cases in this screen are status_id=7, so all are "in service"
    // Split by text status for display, but count all if no text status match
    const inServiceCount = filteredCases.filter(c => 
      c.status === 'In Service' || 
      c.status === 'სერვისშია' ||
      !['Already in service', 'უკვე სერვისში'].includes(c.status)
    ).length;
    const alreadyInServiceCount = filteredCases.filter(c => 
      c.status === 'Already in service' || 
      c.status === 'უკვე სერვისში'
    ).length;
    const totalDays = filteredCases.reduce((sum, c) => sum + c.daysInService, 0);
    const avgDays = filteredCases.length > 0 ? Math.round(totalDays / filteredCases.length) : 0;
    const urgentCount = filteredCases.filter(c => c.daysInService > 5).length;
    
    return { inServiceCount, alreadyInServiceCount, avgDays, urgentCount, total: filteredCases.length };
  };

  const renderCaseCard = ({ item }: { item: CaseWithDetails }) => {
    const caseTotal = calculateCaseTotal(item);
    const services = item.services?.slice(0, 3) || [];
    const isUrgent = item.daysInService > 5;
    
    const handleCardPress = () => {
      // Save scroll position before navigation
      shouldRestoreScrollRef.current = true;
      // For CPanel-only cases, pass source parameter
      if (item.source === 'cpanel') {
        router.push(`/cases/${item.cpanelInvoiceId}?source=cpanel`);
      } else {
        router.push(`/cases/${item.id}`);
      }
    };
    
    return (
      <Card
        style={[styles.caseCard, isUrgent && styles.urgentCard]}
        onPress={handleCardPress}
      >
        {/* Urgent Banner - outside cardContent for full width */}
        {isUrgent && (
          <View style={styles.urgentBanner}>
            <MaterialCommunityIcons name="alert" size={16} color="#FFF" />
            <Text style={styles.urgentText}>გადაუდებელი!</Text>
          </View>
        )}
        <View style={styles.cardContent}>

          {/* Header with plate and status */}
          <View style={styles.cardHeader}>
            <View style={styles.plateContainer}>
              <MaterialCommunityIcons name="car" size={20} color={COLORS.primary} />
              <Text style={styles.plateText}>{item.plate || item.carModel}</Text>
            </View>
            <View style={styles.headerRight}>
              <Chip
                mode="flat"
                style={[
                  styles.statusChip,
                  { backgroundColor: item.status === 'In Service' ? '#2196F3' + '20' : '#9C27B0' + '20' }
                ]}
                textStyle={[
                  styles.statusChipText,
                  { color: item.status === 'In Service' ? '#2196F3' : '#9C27B0' }
                ]}
              >
                {item.status === 'In Service' ? 'სერვისშია' : 'უკვე სერვისში'}
              </Chip>
            </View>
          </View>

          {/* Vehicle Make & Model */}
          {(item.carMake || item.carModel) && (
            <View style={styles.vehicleInfo}>
              <MaterialCommunityIcons name="car-side" size={14} color={COLORS.text.secondary} />
              <Text style={styles.vehicleText} numberOfLines={1}>
                {[item.carMake, item.carModel].filter(Boolean).join(' ')}
              </Text>
            </View>
          )}

          {/* Days in service indicator */}
          <View style={styles.daysContainer}>
            <View style={[styles.daysBadge, { backgroundColor: getDaysInServiceColor(item.daysInService) + '20' }]}>
              <MaterialCommunityIcons 
                name="clock-outline" 
                size={16} 
                color={getDaysInServiceColor(item.daysInService)} 
              />
              <Text style={[styles.daysText, { color: getDaysInServiceColor(item.daysInService) }]}>
                {getDaysInServiceLabel(item.daysInService)} სერვისში
              </Text>
            </View>
          </View>

          {/* Repair Progress Section - Redesigned */}
          <View style={styles.repairProgressSection}>
            {/* Progress Bar + Current Stage */}
            <TouchableOpacity
              style={styles.repairProgressTouchable}
              onPress={() => handleOpenRepairStatusModal(item)}
              activeOpacity={0.7}
            >
              <View style={styles.repairProgressHeader}>
                <View style={styles.repairProgressLabelRow}>
                  <MaterialCommunityIcons
                    name={getRepairStatusIcon(item.repair_status) as any}
                    size={18}
                    color={getRepairStatusColor(item.repair_status)}
                  />
                  <Text style={[styles.repairProgressLabel, { color: getRepairStatusColor(item.repair_status) }]}>
                    {getRepairStatusLabel(item.repair_status)}
                  </Text>
                </View>
                <View style={styles.repairProgressRight}>
                  <Text style={[styles.repairProgressPercent, { color: getRepairStatusColor(item.repair_status) }]}>
                    {getRepairProgress(item.repair_status)}%
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.text.tertiary} />
                </View>
              </View>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${getRepairProgress(item.repair_status)}%`,
                      backgroundColor: getRepairStatusColor(item.repair_status),
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>

            {/* Quick Next Stage Button */}
            {getNextRepairStatus(item.repair_status) && (
              <TouchableOpacity
                style={[
                  styles.quickNextBtn,
                  {
                    backgroundColor: getNextRepairStatus(item.repair_status)!.color + '12',
                    borderColor: getNextRepairStatus(item.repair_status)!.color + '30',
                  },
                ]}
                onPress={() => handleSaveRepairStatus(getNextRepairStatus(item.repair_status)!.value, item)}
                disabled={savingRepairStatus}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={getNextRepairStatus(item.repair_status)!.icon as any}
                  size={14}
                  color={getNextRepairStatus(item.repair_status)!.color}
                />
                <Text style={[styles.quickNextLabel, { color: getNextRepairStatus(item.repair_status)!.color }]}>
                  შემდეგი: {getNextRepairStatus(item.repair_status)!.label}
                </Text>
                <MaterialCommunityIcons name="arrow-right" size={14} color={getNextRepairStatus(item.repair_status)!.color} />
              </TouchableOpacity>
            )}
          </View>

          {/* Assigned Mechanic */}
          {item.assignedMechanic && (
            <View style={styles.mechanicRow}>
              <View style={[styles.mechanicBadge, { backgroundColor: '#6366F1' + '20' }]}>
                <MaterialCommunityIcons name="account-wrench" size={16} color="#6366F1" />
                <Text style={[styles.mechanicText, { color: '#6366F1' }]}>
                  {item.assignedMechanic}
                </Text>
              </View>
            </View>
          )}

          {/* Customer Info */}
          <View style={styles.customerRow}>
            <View style={styles.customerInfo}>
              <MaterialCommunityIcons name="account" size={16} color={COLORS.text.secondary} />
              <Text style={styles.customerName} numberOfLines={1}>
                {item.customerName || 'მომხმარებელი'}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.phoneButton}
              onPress={() => handleCallCustomer(item.customerPhone)}
            >
              <MaterialCommunityIcons name="phone" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <Divider style={styles.divider} />

          {/* Services Preview */}
          <View style={styles.servicesContainer}>
            {services.length > 0 ? (
              <>
                {services.map((service, index) => {
                  const normalized = normalizeService(service);
                  return (
                    <View key={index} style={styles.serviceRow}>
                      <Text style={styles.serviceName} numberOfLines={1}>
                        • {normalized.serviceName}
                      </Text>
                      <Text style={styles.servicePrice}>
                        {formatCurrencyGEL(normalized.price)}
                      </Text>
                    </View>
                  );
                })}
                {(item.services?.length || 0) > 3 && (
                  <Text style={styles.moreServices}>
                    +{(item.services?.length || 0) - 3} სხვა სერვისი...
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.noServices}>სერვისები არ არის დამატებული</Text>
            )}
          </View>

          {/* Footer with actions */}
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
                style={styles.printButton}
                onPress={() => handleOpenWorksheetPreview(item)}
              >
                <MaterialCommunityIcons name="file-document-outline" size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.completeButton}
                onPress={() => handleMarkComplete(item)}
              >
                <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.success} />
                <Text style={styles.completeButtonText}>დასრულება</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Card>
    );
  };

  // ────────────────────────────────────────────────────────────────
  // GRID CARD — Compact 2-column card for grid view
  // ────────────────────────────────────────────────────────────────
  const renderGridCard = ({ item, index }: { item: CaseWithDetails; index: number }) => {
    const caseTotal = calculateCaseTotal(item);
    const isUrgent = item.daysInService > 5;
    const repairProgress = getRepairProgress(item.repair_status);
    const repairColor = getRepairStatusColor(item.repair_status);

    const handleCardPress = () => {
      shouldRestoreScrollRef.current = true;
      if (item.source === 'cpanel') {
        router.push(`/cases/${item.cpanelInvoiceId}?source=cpanel`);
      } else {
        router.push(`/cases/${item.id}`);
      }
    };

    return (
      <TouchableOpacity
        style={[
          styles.gridCard,
          isUrgent && styles.gridCardUrgent,
          { marginLeft: index % 2 === 0 ? 0 : 8 },
        ]}
        onPress={handleCardPress}
        activeOpacity={0.7}
      >
        {/* Urgent indicator strip */}
        {isUrgent && <View style={styles.gridUrgentStrip} />}

        {/* Plate & Days */}
        <View style={styles.gridCardHeader}>
          <Text style={styles.gridPlateText} numberOfLines={1}>
            {item.plate || item.carModel}
          </Text>
          <View style={[styles.gridDaysBadge, { backgroundColor: getDaysInServiceColor(item.daysInService) + '20' }]}>
            <Text style={[styles.gridDaysText, { color: getDaysInServiceColor(item.daysInService) }]}>
              {item.daysInService}დ
            </Text>
          </View>
        </View>

        {/* Vehicle */}
        {(item.carMake || item.carModel) && (
          <Text style={styles.gridVehicleText} numberOfLines={1}>
            {[item.carMake, item.carModel].filter(Boolean).join(' ')}
          </Text>
        )}

        {/* Repair Progress Mini Bar */}
        <View style={styles.gridProgressContainer}>
          <View style={styles.gridProgressRow}>
            <MaterialCommunityIcons
              name={getRepairStatusIcon(item.repair_status) as any}
              size={12}
              color={repairColor}
            />
            <Text style={[styles.gridProgressLabel, { color: repairColor }]} numberOfLines={1}>
              {getRepairStatusLabel(item.repair_status)}
            </Text>
          </View>
          <View style={styles.gridProgressTrack}>
            <View
              style={[
                styles.gridProgressFill,
                { width: `${repairProgress}%` as DimensionValue, backgroundColor: repairColor },
              ]}
            />
          </View>
        </View>

        {/* Mechanic */}
        {item.assignedMechanic && (
          <View style={styles.gridMechanicRow}>
            <MaterialCommunityIcons name="account-wrench" size={12} color="#6366F1" />
            <Text style={styles.gridMechanicText} numberOfLines={1}>
              {item.assignedMechanic}
            </Text>
          </View>
        )}

        {/* Customer */}
        <View style={styles.gridCustomerRow}>
          <MaterialCommunityIcons name="account" size={12} color={COLORS.text.tertiary} />
          <Text style={styles.gridCustomerText} numberOfLines={1}>
            {item.customerName || 'N/A'}
          </Text>
        </View>

        {/* Footer: Total + Status Chip */}
        <View style={styles.gridCardFooter}>
          <Text style={styles.gridTotalText}>
            {formatCurrencyGEL(caseTotal)}
          </Text>
          <View style={[
            styles.gridStatusDot,
            { backgroundColor: item.status === 'In Service' ? '#2196F3' : '#9C27B0' },
          ]} />
        </View>

        {/* Quick action buttons */}
        <View style={styles.gridActions}>
          <TouchableOpacity
            style={styles.gridActionBtn}
            onPress={() => handleOpenRepairStatusModal(item)}
          >
            <MaterialCommunityIcons name="progress-wrench" size={16} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gridActionBtn}
            onPress={() => handleCallCustomer(item.customerPhone)}
          >
            <MaterialCommunityIcons name="phone" size={16} color={COLORS.success} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.gridActionBtn, { backgroundColor: COLORS.success + '15' }]}
            onPress={() => handleMarkComplete(item)}
          >
            <MaterialCommunityIcons name="check" size={16} color={COLORS.success} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // ────────────────────────────────────────────────────────────────
  // FILTER BAR — Horizontal scrollable filter chips
  // ────────────────────────────────────────────────────────────────
  const renderFilterBar = () => {
    const repairCounts = getRepairStatusCounts();
    const mechanics = getUniqueMechanics();
    const activeCount = getActiveFilterCount();

    return (
      <View style={styles.filterBarContainer}>
        {/* Active filters indicator + Clear */}
        {activeCount > 0 && (
          <View style={styles.activeFiltersRow}>
            <View style={styles.activeFiltersBadge}>
              <MaterialCommunityIcons name="filter-check" size={14} color="#FFF" />
              <Text style={styles.activeFiltersText}>{activeCount} ფილტრი</Text>
            </View>
            <TouchableOpacity onPress={clearAllFilters} style={styles.clearFiltersBtn}>
              <MaterialCommunityIcons name="close-circle" size={16} color={COLORS.error} />
              <Text style={styles.clearFiltersText}>გასუფთავება</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Status Filter Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScrollRow}
          contentContainerStyle={styles.filterScrollContent}
        >
          <View style={styles.filterGroupLabel}>
            <MaterialCommunityIcons name="car-wrench" size={14} color={COLORS.text.tertiary} />
          </View>
          {[
            { key: 'all', label: 'ყველა', color: COLORS.primary },
            { key: 'In Service', label: 'სერვისშია', color: '#2196F3' },
            { key: 'Already in service', label: 'უკვე სერვისში', color: '#9C27B0' },
          ].map(f => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterChip,
                statusFilter === f.key && { backgroundColor: f.color, borderColor: f.color },
              ]}
              onPress={() => setStatusFilter(f.key as typeof statusFilter)}
            >
              <Text style={[
                styles.filterChipText,
                statusFilter === f.key && styles.filterChipTextActive,
              ]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Repair Status Filter Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScrollRow}
          contentContainerStyle={styles.filterScrollContent}
        >
          <View style={styles.filterGroupLabel}>
            <MaterialCommunityIcons name="progress-wrench" size={14} color={COLORS.text.tertiary} />
          </View>
          <TouchableOpacity
            style={[
              styles.filterChip,
              repairStatusFilter === 'all' && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
            ]}
            onPress={() => setRepairStatusFilter('all')}
          >
            <Text style={[
              styles.filterChipText,
              repairStatusFilter === 'all' && styles.filterChipTextActive,
            ]}>
              ყველა
            </Text>
            <View style={styles.filterChipBadge}>
              <Text style={styles.filterChipBadgeText}>{repairCounts['all']}</Text>
            </View>
          </TouchableOpacity>
          {repairStatusOptions.map(opt => {
            const filterKey = opt.value || '__none__';
            const count = repairCounts[filterKey] || 0;
            if (count === 0) return null;
            return (
              <TouchableOpacity
                key={filterKey}
                style={[
                  styles.filterChip,
                  repairStatusFilter === filterKey && { backgroundColor: opt.color, borderColor: opt.color },
                ]}
                onPress={() => setRepairStatusFilter(filterKey)}
              >
                <MaterialCommunityIcons
                  name={opt.icon as any}
                  size={13}
                  color={repairStatusFilter === filterKey ? '#FFF' : opt.color}
                />
                <Text style={[
                  styles.filterChipText,
                  repairStatusFilter === filterKey && styles.filterChipTextActive,
                ]} numberOfLines={1}>
                  {opt.label}
                </Text>
                <View style={[
                  styles.filterChipBadge,
                  repairStatusFilter === filterKey && { backgroundColor: 'rgba(255,255,255,0.3)' },
                ]}>
                  <Text style={[
                    styles.filterChipBadgeText,
                    repairStatusFilter === filterKey && { color: '#FFF' },
                  ]}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Mechanic Filter Row (only show if mechanics exist) */}
        {mechanics.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollRow}
            contentContainerStyle={styles.filterScrollContent}
          >
            <View style={styles.filterGroupLabel}>
              <MaterialCommunityIcons name="account-wrench" size={14} color={COLORS.text.tertiary} />
            </View>
            <TouchableOpacity
              style={[
                styles.filterChip,
                mechanicFilter === 'all' && { backgroundColor: '#6366F1', borderColor: '#6366F1' },
              ]}
              onPress={() => setMechanicFilter('all')}
            >
              <Text style={[
                styles.filterChipText,
                mechanicFilter === 'all' && styles.filterChipTextActive,
              ]}>
                ყველა
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterChip,
                mechanicFilter === '__unassigned__' && { backgroundColor: '#94A3B8', borderColor: '#94A3B8' },
              ]}
              onPress={() => setMechanicFilter('__unassigned__')}
            >
              <Text style={[
                styles.filterChipText,
                mechanicFilter === '__unassigned__' && styles.filterChipTextActive,
              ]}>
                არ არის მინიჭებული
              </Text>
            </TouchableOpacity>
            {mechanics.map(m => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.filterChip,
                  mechanicFilter === m && { backgroundColor: '#6366F1', borderColor: '#6366F1' },
                ]}
                onPress={() => setMechanicFilter(m)}
              >
                <MaterialCommunityIcons
                  name="account"
                  size={13}
                  color={mechanicFilter === m ? '#FFF' : '#6366F1'}
                />
                <Text style={[
                  styles.filterChipText,
                  mechanicFilter === m && styles.filterChipTextActive,
                ]} numberOfLines={1}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  const filteredCases = filterAndSortCases();
  const stats = getStatistics();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>სერვისის შემთხვევების ჩატვირთვა...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Surface style={styles.header} elevation={2}>
        <View style={styles.headerContent}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="car-wrench" size={28} color={COLORS.primary} />
            <Text style={styles.headerTitle}>სერვისში</Text>
            <Chip mode="flat" style={styles.countChip}>
              {filteredCases.length}{stats.total !== filteredCases.length ? `/${stats.total}` : ''}
            </Chip>
          </View>
          <View style={styles.headerActions}>
            <IconButton
              icon={showSearch ? 'close' : 'magnify'}
              size={22}
              onPress={() => setShowSearch(!showSearch)}
            />
            <Menu
              visible={sortMenuVisible}
              onDismiss={() => setSortMenuVisible(false)}
              anchor={
                <IconButton
                  icon="sort"
                  size={22}
                  onPress={() => setSortMenuVisible(true)}
                />
              }
            >
              <Menu.Item onPress={() => { setSortBy('days_high'); setSortMenuVisible(false); }} title="🔴 მეტი დღე → ნაკლები" />
              <Menu.Item onPress={() => { setSortBy('days_low'); setSortMenuVisible(false); }} title="🟢 ნაკლები დღე → მეტი" />
              <Menu.Item onPress={() => { setSortBy('cost_high'); setSortMenuVisible(false); }} title="💰 ფასი: მაღალი → დაბალი" />
              <Menu.Item onPress={() => { setSortBy('cost_low'); setSortMenuVisible(false); }} title="💵 ფასი: დაბალი → მაღალი" />
              <Menu.Item onPress={() => { setSortBy('newest'); setSortMenuVisible(false); }} title="📅 ახალი → ძველი" />
              <Menu.Item onPress={() => { setSortBy('oldest'); setSortMenuVisible(false); }} title="📆 ძველი → ახალი" />
            </Menu>
            {/* View Mode Toggle */}
            <View style={styles.viewToggleContainer}>
              <TouchableOpacity
                style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
                onPress={() => setViewMode('list')}
              >
                <MaterialCommunityIcons
                  name="view-list"
                  size={18}
                  color={viewMode === 'list' ? '#FFF' : COLORS.text.secondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleBtnActive]}
                onPress={() => setViewMode('grid')}
              >
                <MaterialCommunityIcons
                  name="view-grid"
                  size={18}
                  color={viewMode === 'grid' ? '#FFF' : COLORS.text.secondary}
                />
              </TouchableOpacity>
            </View>
            {/* Filter bar toggle */}
            <TouchableOpacity
              style={[styles.filterToggleBtn, showFilterBar && styles.filterToggleBtnActive]}
              onPress={() => setShowFilterBar(!showFilterBar)}
            >
              <MaterialCommunityIcons
                name="filter-variant"
                size={20}
                color={showFilterBar ? '#FFF' : COLORS.text.secondary}
              />
              {getActiveFilterCount() > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{getActiveFilterCount()}</Text>
                </View>
              )}
            </TouchableOpacity>
            <IconButton
              icon="refresh"
              size={22}
              onPress={onRefresh}
              loading={refreshing}
            />
          </View>
        </View>
        
        {showSearch && (
          <Searchbar
            placeholder="ძებნა: ნომერი, მარკა, კლიენტი, მექანიკოსი..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
          />
        )}

        {/* Statistics Row */}
        <View style={styles.statsContainer}>
          <View style={[styles.statBox, { backgroundColor: '#2196F3' + '15' }]}>
            <Text style={[styles.statValue, { color: '#2196F3' }]}>{stats.total}</Text>
            <Text style={[styles.statLabel, { color: '#2196F3' }]}>სულ</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#9C27B0' + '15' }]}>
            <Text style={[styles.statValue, { color: '#9C27B0' }]}>{stats.alreadyInServiceCount}</Text>
            <Text style={[styles.statLabel, { color: '#9C27B0' }]}>უკვე{"\n"}სერვისში</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: COLORS.warning + '15' }]}>
            <Text style={[styles.statValue, { color: COLORS.warning }]}>{stats.avgDays}</Text>
            <Text style={[styles.statLabel, { color: COLORS.warning }]}>საშ.{"\n"}დღეები</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: COLORS.error + '15' }]}>
            <Text style={[styles.statValue, { color: COLORS.error }]}>{stats.urgentCount}</Text>
            <Text style={[styles.statLabel, { color: COLORS.error }]}>გადაუდებე{"\n"}ლი</Text>
          </View>
        </View>
      </Surface>

      {/* Filter Bar */}
      {showFilterBar && renderFilterBar()}

      {/* Cases List / Grid */}
      {filteredCases.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="car-off" size={64} color={COLORS.text.disabled} />
          <Text style={styles.emptyTitle}>
            {getActiveFilterCount() > 0 
              ? 'შედეგები არ მოიძებნა' 
              : 'სერვისში მყოფი შემთხვევები არ არის'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {getActiveFilterCount() > 0
              ? 'სცადეთ სხვა ფილტრების პარამეტრები ან გაასუფთავეთ ფილტრები'
              : 'როდესაც შემთხვევას მიანიჭებთ "სერვისშია" სტატუსს, ის აქ გამოჩნდება'}
          </Text>
          {getActiveFilterCount() > 0 && (
            <TouchableOpacity style={styles.emptyResetBtn} onPress={clearAllFilters}>
              <MaterialCommunityIcons name="filter-remove" size={18} color={COLORS.primary} />
              <Text style={styles.emptyResetText}>ფილტრების გასუფთავება</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : viewMode === 'grid' ? (
        <FlatList
          key="grid"
          data={filteredCases}
          renderItem={renderGridCard}
          keyExtractor={(item) => `grid-${item.source}-${item.id}`}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridListContent}
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
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          key="list"
          ref={flatListRef}
          data={filteredCases}
          renderItem={renderCaseCard}
          keyExtractor={(item) => `list-${item.source}-${item.id}`}
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
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Repair Status Bottom Sheet */}
      <Modal
        visible={showRepairStatusModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowRepairStatusModal(false);
          setSelectedCase(null);
        }}
      >
        <TouchableOpacity
          style={styles.bottomSheetOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowRepairStatusModal(false);
            setSelectedCase(null);
          }}
        >
          <TouchableOpacity activeOpacity={1} style={styles.bottomSheetContainer}>
            {/* Drag Handle */}
            <View style={styles.bottomSheetHandle}>
              <View style={styles.bottomSheetHandleBar} />
            </View>

            {/* Header */}
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>რემონტის ეტაპი</Text>
              {selectedCase && (
                <Text style={styles.bottomSheetSubtitle}>
                  🚗 {selectedCase.plate || selectedCase.carModel}
                  {selectedCase.customerName ? `  •  ${selectedCase.customerName}` : ''}
                </Text>
              )}
            </View>

            {/* Visual Timeline */}
            <ScrollView
              style={styles.bottomSheetContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {repairStatusOptions.map((option, index) => {
                const currentStep = getCurrentStep(selectedCase?.repair_status);
                const isCompleted = option.step > 0 && option.step < currentStep;
                const isCurrent = option.step === currentStep;
                const isFuture = option.step > currentStep;
                const isLast = index === repairStatusOptions.length - 1;

                return (
                  <TouchableOpacity
                    key={option.value || 'none'}
                    style={styles.timelineOption}
                    onPress={() => handleSaveRepairStatus(option.value)}
                    disabled={savingRepairStatus}
                    activeOpacity={0.6}
                  >
                    {/* Timeline Connector */}
                    <View style={styles.timelineConnector}>
                      {index > 0 && (
                        <View
                          style={[
                            styles.timelineLineTop,
                            (isCompleted || isCurrent) ? { backgroundColor: option.color } : { backgroundColor: '#E2E8F0' },
                          ]}
                        />
                      )}
                      <View
                        style={[
                          styles.timelineDot,
                          isCurrent && [
                            styles.timelineDotActive,
                            { backgroundColor: option.color, borderColor: option.color + '40' },
                          ],
                          isCompleted && { backgroundColor: option.color },
                          isFuture && styles.timelineDotFuture,
                          option.step === 0 && !isCurrent && { backgroundColor: '#CBD5E1' },
                        ]}
                      >
                        {isCompleted && (
                          <MaterialCommunityIcons name="check" size={10} color="#FFF" />
                        )}
                        {isCurrent && (
                          <MaterialCommunityIcons name={option.icon as any} size={12} color="#FFF" />
                        )}
                      </View>
                      {!isLast && (
                        <View
                          style={[
                            styles.timelineLineBottom,
                            isCompleted
                              ? { backgroundColor: repairStatusOptions[index + 1]?.color || '#E2E8F0' }
                              : { backgroundColor: '#E2E8F0' },
                          ]}
                        />
                      )}
                    </View>

                    {/* Option Content */}
                    <View
                      style={[
                        styles.timelineContent,
                        isCurrent && {
                          backgroundColor: option.color + '10',
                          borderColor: option.color + '30',
                        },
                      ]}
                    >
                      <View style={styles.timelineContentRow}>
                        <MaterialCommunityIcons
                          name={option.icon as any}
                          size={20}
                          color={isFuture ? '#94A3B8' : option.color}
                        />
                        <Text
                          style={[
                            styles.timelineLabel,
                            isCurrent && { color: option.color, fontWeight: '700' },
                            isCompleted && { color: option.color, fontWeight: '600' },
                            isFuture && { color: '#94A3B8' },
                          ]}
                        >
                          {option.label}
                        </Text>
                        {isCurrent && (
                          <View style={[styles.currentBadge, { backgroundColor: option.color }]}>
                            <Text style={styles.currentBadgeText}>ახლა</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {savingRepairStatus && (
              <View style={styles.bottomSheetLoading}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.bottomSheetLoadingText}>ინახება...</Text>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Worksheet Preview Modal */}
      <Modal
        visible={showWorksheetModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowWorksheetModal(false);
          setWorksheetCase(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.worksheetModal}>
            <View style={styles.worksheetHeader}>
              <Text style={styles.worksheetTitle}>📋 სამუშაო ფურცელი</Text>
              <Text style={styles.worksheetSubtitle}>
                {worksheetCase?.plate || worksheetCase?.carModel}
              </Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => {
                  setShowWorksheetModal(false);
                  setWorksheetCase(null);
                }}
              >
                <MaterialCommunityIcons name="close" size={24} color={COLORS.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.worksheetContent}>
              {/* Vehicle Info Section */}
              <View style={styles.worksheetSection}>
                <Text style={styles.worksheetSectionTitle}>🚗 ავტომობილის ინფორმაცია</Text>
                <View style={styles.worksheetInfoRow}>
                  <Text style={styles.worksheetLabel}>ნომერი:</Text>
                  <Text style={styles.worksheetValue}>{worksheetCase?.plate || 'N/A'}</Text>
                </View>
                {(worksheetCase?.carMake || worksheetCase?.carModel) && (
                  <View style={styles.worksheetInfoRow}>
                    <Text style={styles.worksheetLabel}>მარკა/მოდელი:</Text>
                    <Text style={styles.worksheetValue}>
                      {[worksheetCase?.carMake, worksheetCase?.carModel].filter(Boolean).join(' ')}
                    </Text>
                  </View>
                )}
                {worksheetCase?.repair_status && (
                  <View style={styles.worksheetInfoRow}>
                    <Text style={styles.worksheetLabel}>ეტაპი:</Text>
                    <Text style={styles.worksheetValue}>
                      {getRepairStatusLabel(worksheetCase?.repair_status)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Customer Info Section */}
              <View style={styles.worksheetSection}>
                <Text style={styles.worksheetSectionTitle}>👤 კლიენტი</Text>
                <View style={styles.worksheetInfoRow}>
                  <Text style={styles.worksheetLabel}>სახელი:</Text>
                  <Text style={styles.worksheetValue}>{worksheetCase?.customerName || 'N/A'}</Text>
                </View>
                <View style={styles.worksheetInfoRow}>
                  <Text style={styles.worksheetLabel}>ტელეფონი:</Text>
                  <Text style={styles.worksheetValue}>{worksheetCase?.customerPhone || 'N/A'}</Text>
                </View>
              </View>

              {/* Services Section */}
              <View style={styles.worksheetSection}>
                <Text style={styles.worksheetSectionTitle}>📋 შესასრულებელი სამუშაოები</Text>
                {worksheetCase?.services && worksheetCase.services.length > 0 ? (
                  worksheetCase.services.map((service, index) => {
                    const normalized = normalizeService(service);
                    return (
                      <View key={index} style={styles.worksheetServiceRow}>
                        <View style={styles.worksheetCheckbox}>
                          <MaterialCommunityIcons 
                            name="checkbox-blank-outline" 
                            size={22} 
                            color={COLORS.text.secondary} 
                          />
                        </View>
                        <View style={styles.worksheetServiceInfo}>
                          <Text style={styles.worksheetServiceName}>{normalized.serviceName}</Text>
                          {normalized.count > 1 && (
                            <Text style={styles.worksheetServiceQty}>რაოდენობა: {normalized.count}</Text>
                          )}
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.worksheetEmpty}>სერვისები არ არის მითითებული</Text>
                )}
              </View>

              {/* Parts Section */}
              {worksheetCase?.parts && worksheetCase.parts.length > 0 && (
                <View style={styles.worksheetSection}>
                  <Text style={styles.worksheetSectionTitle}>🔧 საჭირო ნაწილები</Text>
                  {worksheetCase.parts.map((part, index) => {
                    const partName = part.name || part.partName || 'ნაწილი';
                    const qty = part.quantity || 1;
                    return (
                      <View key={index} style={styles.worksheetServiceRow}>
                        <View style={styles.worksheetCheckbox}>
                          <MaterialCommunityIcons 
                            name="checkbox-blank-outline" 
                            size={22} 
                            color={COLORS.text.secondary} 
                          />
                        </View>
                        <View style={styles.worksheetServiceInfo}>
                          <Text style={styles.worksheetServiceName}>{partName}</Text>
                          <Text style={styles.worksheetServiceQty}>რაოდენობა: {qty}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Notes Section */}
              <View style={styles.worksheetSection}>
                <Text style={styles.worksheetSectionTitle}>📝 შენიშვნები</Text>
                <View style={styles.worksheetNotesBox}>
                  <Text style={styles.worksheetNotesPlaceholder}>
                    ტექნიკოსის შენიშვნები...
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.worksheetFooter}>
              <Button 
                mode="outlined" 
                onPress={() => {
                  setShowWorksheetModal(false);
                  setWorksheetCase(null);
                }}
                style={styles.worksheetCancelButton}
              >
                დახურვა
              </Button>
              <Button 
                mode="outlined" 
                onPress={() => {
                  if (worksheetCase) {
                    handleShareWorksheetPDF(worksheetCase);
                  }
                }}
                style={styles.worksheetShareButton}
                icon="share-variant"
              >
                PDF
              </Button>
              <Button 
                mode="contained" 
                onPress={() => {
                  if (worksheetCase) {
                    handlePrintWorksheet(worksheetCase);
                  }
                }}
                style={styles.worksheetPrintButton}
                icon="printer"
              >
                ბეჭდვა
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
    backgroundColor: COLORS.primary + '20',
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
  urgentCard: {
    borderWidth: 2,
    borderColor: COLORS.error,
  },
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.error,
    paddingVertical: 8,
  },
  urgentText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
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
  daysContainer: {
    marginBottom: 12,
  },
  daysBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  daysText: {
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
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.success + '15',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.success + '30',
  },
  completeButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.success,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  completedBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.success,
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
  // Repair Progress Card Styles
  repairProgressSection: {
    marginBottom: 12,
    gap: 8,
  },
  repairProgressTouchable: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
  },
  repairProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  repairProgressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  repairProgressLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  repairProgressRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  repairProgressPercent: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    minWidth: 4,
  },
  quickNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickNextLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Mechanic Styles
  mechanicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  mechanicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  mechanicText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Shared Modal Styles (used by worksheet modal)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCloseButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    zIndex: 1,
  },
  // Bottom Sheet Styles
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '78%',
    paddingBottom: 28,
  },
  bottomSheetHandle: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  bottomSheetHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  bottomSheetHeader: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
  },
  bottomSheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text.primary,
  },
  bottomSheetSubtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  bottomSheetContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  // Timeline Styles
  timelineOption: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 54,
  },
  timelineConnector: {
    width: 36,
    alignItems: 'center',
  },
  timelineLineTop: {
    width: 2,
    flex: 1,
  },
  timelineLineBottom: {
    width: 2,
    flex: 1,
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  timelineDotActive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
  },
  timelineDotFuture: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  timelineContent: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 8,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  timelineContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timelineLabel: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  currentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  bottomSheetLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bottomSheetLoadingText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  // Footer actions
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  printButton: {
    padding: 10,
    backgroundColor: COLORS.primary + '15',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  // Worksheet Modal Styles
  worksheetModal: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  worksheetHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
    alignItems: 'center',
  },
  worksheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  worksheetSubtitle: {
    fontSize: 16,
    color: COLORS.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  worksheetContent: {
    padding: 16,
    maxHeight: 450,
  },
  worksheetSection: {
    marginBottom: 20,
    backgroundColor: COLORS.background,
    padding: 14,
    borderRadius: 12,
  },
  worksheetSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
    paddingBottom: 8,
  },
  worksheetInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  worksheetLabel: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  worksheetValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  worksheetServiceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline + '50',
  },
  worksheetCheckbox: {
    marginRight: 12,
    marginTop: 2,
  },
  worksheetServiceInfo: {
    flex: 1,
  },
  worksheetServiceName: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text.primary,
  },
  worksheetServiceQty: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  worksheetEmpty: {
    fontSize: 14,
    color: COLORS.text.disabled,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  worksheetNotesBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
  },
  worksheetNotesPlaceholder: {
    fontSize: 14,
    color: COLORS.text.disabled,
    fontStyle: 'italic',
  },
  worksheetFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  worksheetCancelButton: {
    flex: 0.8,
    borderColor: COLORS.outline,
  },
  worksheetShareButton: {
    flex: 0.8,
    borderColor: COLORS.primary,
  },
  worksheetPrintButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },

  // ══════════════════════════════════════════════════════════════
  // VIEW TOGGLE STYLES
  // ══════════════════════════════════════════════════════════════
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 2,
    marginHorizontal: 2,
  },
  viewToggleBtn: {
    padding: 6,
    borderRadius: 6,
  },
  viewToggleBtnActive: {
    backgroundColor: COLORS.primary,
  },
  filterToggleBtn: {
    padding: 6,
    borderRadius: 8,
    marginHorizontal: 2,
    position: 'relative',
  },
  filterToggleBtnActive: {
    backgroundColor: COLORS.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFF',
  },

  // ══════════════════════════════════════════════════════════════
  // FILTER BAR STYLES
  // ══════════════════════════════════════════════════════════════
  filterBarContainer: {
    backgroundColor: COLORS.surface,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline + '40',
  },
  activeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  activeFiltersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeFiltersText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearFiltersText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.error,
  },
  filterScrollRow: {
    maxHeight: 40,
  },
  filterScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: 'center',
    gap: 6,
  },
  filterGroupLabel: {
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.outline,
    backgroundColor: COLORS.surface,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  filterChipBadge: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterChipBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.text.secondary,
  },

  // ══════════════════════════════════════════════════════════════
  // GRID VIEW STYLES
  // ══════════════════════════════════════════════════════════════
  gridListContent: {
    padding: 16,
    paddingBottom: 100,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  gridCard: {
    flex: 1,
    maxWidth: GRID_CARD_WIDTH,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  gridCardUrgent: {
    borderWidth: 1.5,
    borderColor: COLORS.error + '40',
  },
  gridUrgentStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: COLORS.error,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  gridCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  gridPlateText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text.primary,
    flex: 1,
    marginRight: 4,
  },
  gridDaysBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  gridDaysText: {
    fontSize: 11,
    fontWeight: '700',
  },
  gridVehicleText: {
    fontSize: 11,
    color: COLORS.text.tertiary,
    marginBottom: 8,
  },
  gridProgressContainer: {
    marginBottom: 8,
  },
  gridProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  gridProgressLabel: {
    fontSize: 10,
    fontWeight: '600',
    flex: 1,
  },
  gridProgressTrack: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  gridProgressFill: {
    height: '100%' as DimensionValue,
    borderRadius: 2,
    minWidth: 2,
  },
  gridMechanicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  gridMechanicText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6366F1',
    flex: 1,
  },
  gridCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  gridCustomerText: {
    fontSize: 11,
    color: COLORS.text.tertiary,
    flex: 1,
  },
  gridCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline + '40',
  },
  gridTotalText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  gridStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  gridActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  gridActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.background,
  },

  // ══════════════════════════════════════════════════════════════
  // EMPTY STATE EXTRAS
  // ══════════════════════════════════════════════════════════════
  emptyResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '15',
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  emptyResetText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
