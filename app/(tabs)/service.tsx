import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
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
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  
  // Repair status modal states
  const [showRepairStatusModal, setShowRepairStatusModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseWithDetails | null>(null);
  const [savingRepairStatus, setSavingRepairStatus] = useState(false);
  
  // Worksheet modal states
  const [showWorksheetModal, setShowWorksheetModal] = useState(false);
  const [worksheetCase, setWorksheetCase] = useState<CaseWithDetails | null>(null);

  // Repair status options
  const repairStatusOptions = [
    { value: null, label: 'არ არის', icon: 'minus-circle-outline', color: '#94A3B8' },
    { value: 'წინასწარი შეფასება', label: 'წინასწარი შეფასება', icon: 'clipboard-text-outline', color: '#6366F1' },
    { value: 'მუშავდება', label: 'მუშავდება', icon: 'progress-wrench', color: '#8B5CF6' },
    { value: 'იღებება', label: 'იღებება', icon: 'package-down', color: '#F59E0B' },
    { value: 'იშლება', label: 'იშლება', icon: 'car-off', color: '#F59E0B' },
    { value: 'აწყობა', label: 'აწყობა', icon: 'car-cog', color: '#F59E0B' },
    { value: 'თუნუქი', label: 'თუნუქი', icon: 'spray', color: '#10B981' },
    { value: 'პლასტმასის აღდგენა', label: 'პლასტმასის აღდგენა', icon: 'hammer-wrench', color: '#10B981' },
    { value: 'პოლირება', label: 'პოლირება', icon: 'shimmer', color: '#10B981' },
    { value: 'დაშლილი და გასული', label: 'დაშლილი და გასული', icon: 'check-circle', color: '#059669' },
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
          const daysInService = Math.floor((Date.now() - new Date(inspection.updatedAt || inspection.createdAt).getTime()) / (1000 * 60 * 60 * 24));
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
            statusColor: getStatusColor(inspection.createdAt),
            statusLabel: getStatusLabel(inspection.createdAt),
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
              const daysInService = Math.floor((Date.now() - new Date(invoice.updatedAt || invoice.createdAt).getTime()) / (1000 * 60 * 60 * 24));
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
                statusColor: getStatusColor(invoice.createdAt),
                statusLabel: getStatusLabel(invoice.createdAt),
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
          (caseItem.services?.some(s => s.serviceName.toLowerCase().includes(searchLower)) || false)
        );
      });
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filteredCases = filteredCases.filter(c => c.status === statusFilter);
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
              loadServiceCases();
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

  const handleSaveRepairStatus = async (newStatus: string | null) => {
    if (!selectedCase) return;
    
    try {
      setSavingRepairStatus(true);
      
      const updateData = {
        repair_status: newStatus,
        updatedAt: new Date().toISOString(),
      };

      // Update CPanel if we have ID
      if (selectedCase.cpanelInvoiceId) {
        const { updateInvoiceToCPanel } = require('../../src/services/cpanelService');
        await updateInvoiceToCPanel(selectedCase.cpanelInvoiceId, updateData);
      }

      // Update Firebase if not CPanel-only
      if (selectedCase.source !== 'cpanel') {
        const { updateInspection } = require('../../src/services/firebase');
        await updateInspection(selectedCase.id, updateData, selectedCase.cpanelInvoiceId || undefined);
      }

      // Update local state
      setCases(prevCases => 
        prevCases.map(c => 
          c.id === selectedCase.id 
            ? { ...c, repair_status: newStatus }
            : c
        )
      );

      setShowRepairStatusModal(false);
      setSelectedCase(null);
      Alert.alert('✅ წარმატება', 'რემონტის სტატუსი განახლდა');
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

          {/* Repair Status - Clickable */}
          <TouchableOpacity 
            style={styles.repairStatusRow}
            onPress={() => handleOpenRepairStatusModal(item)}
          >
            <View style={[styles.repairStatusBadge, { backgroundColor: getRepairStatusColor(item.repair_status) + '20' }]}>
              <MaterialCommunityIcons 
                name={getRepairStatusIcon(item.repair_status) as any}
                size={16} 
                color={getRepairStatusColor(item.repair_status)} 
              />
              <Text style={[styles.repairStatusText, { color: getRepairStatusColor(item.repair_status) }]}>
                {getRepairStatusLabel(item.repair_status)}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.text.secondary} />
          </TouchableOpacity>

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
              {stats.total}
            </Chip>
          </View>
          <View style={styles.headerActions}>
            <IconButton
              icon={showSearch ? 'close' : 'magnify'}
              size={24}
              onPress={() => setShowSearch(!showSearch)}
            />
            <Menu
              visible={sortMenuVisible}
              onDismiss={() => setSortMenuVisible(false)}
              anchor={
                <IconButton
                  icon="sort"
                  size={24}
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
            <Menu
              visible={filterMenuVisible}
              onDismiss={() => setFilterMenuVisible(false)}
              anchor={
                <IconButton
                  icon="filter"
                  size={24}
                  onPress={() => setFilterMenuVisible(true)}
                />
              }
            >
              <Menu.Item onPress={() => { setStatusFilter('all'); setFilterMenuVisible(false); }} title="ყველა" />
              <Menu.Item onPress={() => { setStatusFilter('In Service'); setFilterMenuVisible(false); }} title="სერვისშია" />
              <Menu.Item onPress={() => { setStatusFilter('Already in service'); setFilterMenuVisible(false); }} title="უკვე სერვისში" />
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

      {/* Cases List */}
      {filteredCases.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="car-off" size={64} color={COLORS.text.disabled} />
          <Text style={styles.emptyTitle}>
            {searchQuery || statusFilter !== 'all' 
              ? 'შედეგები არ მოიძებნა' 
              : 'სერვისში მყოფი შემთხვევები არ არის'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery || statusFilter !== 'all'
              ? 'სცადეთ სხვა ძებნის პარამეტრები'
              : 'როდესაც შემთხვევას მიანიჭებთ "სერვისშია" სტატუსს, ის აქ გამოჩნდება'}
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
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Repair Status Modal */}
      <Modal
        visible={showRepairStatusModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowRepairStatusModal(false);
          setSelectedCase(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.repairStatusModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>რემონტის სტატუსი</Text>
              {selectedCase && (
                <Text style={styles.modalSubtitle}>{selectedCase.plate || selectedCase.carModel}</Text>
              )}
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => {
                  setShowRepairStatusModal(false);
                  setSelectedCase(null);
                }}
              >
                <MaterialCommunityIcons name="close" size={24} color={COLORS.text.secondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {repairStatusOptions.map((option) => (
              <TouchableOpacity
                key={option.value || 'none'}
                style={[
                  styles.repairStatusOption,
                  selectedCase?.repair_status === option.value && styles.repairStatusOptionActive,
                  { borderLeftColor: option.color }
                ]}
                onPress={() => handleSaveRepairStatus(option.value)}
                disabled={savingRepairStatus}
              >
                <MaterialCommunityIcons 
                  name={option.icon as any} 
                  size={24} 
                  color={option.color} 
                />
                <Text style={[
                  styles.repairStatusOptionText,
                  selectedCase?.repair_status === option.value && { color: option.color, fontWeight: '700' }
                ]}>
                  {option.label}
                </Text>
                {selectedCase?.repair_status === option.value && (
                  <MaterialCommunityIcons name="check" size={20} color={option.color} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.modalFooter}>
            <Button 
              mode="outlined" 
              onPress={() => {
                setShowRepairStatusModal(false);
                setSelectedCase(null);
              }}
              style={styles.modalCancelButton}
            >
              დახურვა
            </Button>
          </View>
          {savingRepairStatus && (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          )}
          </View>
        </View>
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
  // Repair Status Card Styles
  repairStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 6,
  },
  repairStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  repairStatusText: {
    fontSize: 13,
    fontWeight: '600',
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
  // Repair Status Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  repairStatusModal: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalCloseButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    zIndex: 1,
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  modalContent: {
    padding: 12,
    maxHeight: 400,
  },
  repairStatusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginVertical: 4,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  repairStatusOptionActive: {
    backgroundColor: COLORS.primary + '10',
  },
  repairStatusOptionText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text.primary,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  modalCancelButton: {
    borderColor: COLORS.outline,
  },
  modalLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
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
});
