import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Dimensions,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { COLORS, SHADOWS } from '../../src/config/constants';
import { fetchAllCPanelInvoices } from '../../src/services/cpanelService';
import { getAllInspections } from '../../src/services/firebase';
import { formatCurrencyGEL } from '../../src/utils/helpers';

const { width } = Dimensions.get('window');

// ─── Interfaces ──────────────────────────────────────────────────
interface DashboardStats {
  totalCases: number;
  inServiceCount: number;
  completedCount: number;
  pendingCount: number;
  todayNewCases: number;
  todayCompleted: number;
  totalRevenue: number;
  monthRevenue: number;
  weekRevenue: number;
  avgDaysInService: number;
  urgentCount: number;
  mechanics: string[];
}

interface RecentCase {
  id: string;
  plate: string;
  carMake?: string;
  carModel?: string;
  customerName?: string;
  totalPrice: number;
  status: string;
  statusId?: number;
  repairStatus?: string | null;
  daysAgo: number;
  source: 'firebase' | 'cpanel';
  cpanelInvoiceId?: string;
}

// ─── Component ───────────────────────────────────────────────────
export default function DashboardScreen() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCases: 0, inServiceCount: 0, completedCount: 0, pendingCount: 0,
    todayNewCases: 0, todayCompleted: 0, totalRevenue: 0, monthRevenue: 0,
    weekRevenue: 0, avgDaysInService: 0, urgentCount: 0, mechanics: [],
  });
  const [recentCases, setRecentCases] = useState<RecentCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = async () => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Fetch from both sources in parallel
      const [inspections, cpanelResult] = await Promise.all([
        getAllInspections().catch(() => []),
        fetchAllCPanelInvoices({ limit: 500 }).catch(() => ({ success: false, invoices: [] })),
      ]);

      const cpanelInvoices = (cpanelResult as any)?.success
        ? (cpanelResult as any).invoices || []
        : [];

      // Deduplicate: cPanel is the authoritative source
      const cpanelIds = new Set(
        cpanelInvoices.map((c: any) => c.cpanelId?.toString()).filter(Boolean)
      );
      const cpanelPlates = new Set(
        cpanelInvoices.map((c: any) => c.plate?.toUpperCase()).filter(Boolean)
      );

      const uniqueFirebase = (inspections as any[]).filter((fb: any) => {
        if (fb.cpanelInvoiceId && cpanelIds.has(fb.cpanelInvoiceId.toString())) return false;
        if (fb.plate && cpanelPlates.has(fb.plate.toUpperCase())) return false;
        return true;
      });

      // Merge all cases into a unified array
      const allCases = [
        ...cpanelInvoices.map((inv: any) => ({
          id: inv.cpanelId?.toString() || '',
          plate: inv.plate || inv.carModel || 'N/A',
          carMake: inv.carMake || '',
          carModel: inv.carModel || '',
          customerName: inv.customerName || '',
          totalPrice: inv.totalPrice || 0,
          status: inv.status || 'New',
          statusId: parseInt(inv.status_id) || parseInt(inv.statusId) || 0,
          repairStatus: inv.repair_status || null,
          createdAt: inv.createdAt || '',
          completedAt: inv.completedAt || inv.completed_at || null,
          source: 'cpanel' as const,
          cpanelInvoiceId: inv.cpanelId?.toString() || '',
          assignedMechanic: inv.assigned_mechanic || inv.assignedMechanic || null,
        })),
        ...uniqueFirebase.map((fb: any) => ({
          id: fb.id,
          plate: fb.plate || fb.carModel || 'N/A',
          carMake: fb.carMake || '',
          carModel: fb.carModel || '',
          customerName: fb.customerName || '',
          totalPrice: fb.totalPrice || 0,
          status: fb.status || 'Pending',
          statusId: fb.status_id || fb.statusId || 0,
          repairStatus: fb.repair_status || null,
          createdAt: fb.createdAt || '',
          completedAt: fb.completedAt || null,
          source: 'firebase' as const,
          cpanelInvoiceId: fb.cpanelInvoiceId || '',
          assignedMechanic: fb.assignedMechanic || null,
        })),
      ];

      // Compute stats
      const completedStatuses = ['Completed', 'completed', 'დასრულებული', 'COMPLETED'];
      const SERVICE_STATUS_ID = 7;

      let inService = 0;
      let completed = 0;
      let pending = 0;
      let todayNew = 0;
      let todayComp = 0;
      let totalRev = 0;
      let monthRev = 0;
      let weekRev = 0;
      let totalServiceDays = 0;
      let serviceCount = 0;
      let urgent = 0;
      const mechanicSet = new Set<string>();

      allCases.forEach((c: any) => {
        const created = new Date(c.createdAt);
        const price = c.totalPrice || 0;

        if (completedStatuses.includes(c.status)) {
          completed++;
          totalRev += price;
          if (c.completedAt && new Date(c.completedAt) >= monthStart) monthRev += price;
          if (c.completedAt && new Date(c.completedAt) >= weekAgo) weekRev += price;
          if (c.completedAt && new Date(c.completedAt) >= todayStart) todayComp++;
        } else if (
          c.statusId === SERVICE_STATUS_ID ||
          c.status === 'In Service' ||
          c.status === 'Already in service'
        ) {
          inService++;
          const days = Math.floor(
            (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
          );
          totalServiceDays += days;
          serviceCount++;
          if (days > 5) urgent++;
        } else {
          pending++;
        }

        if (created >= todayStart) todayNew++;
        if (c.assignedMechanic) mechanicSet.add(c.assignedMechanic);
      });

      setStats({
        totalCases: allCases.length,
        inServiceCount: inService,
        completedCount: completed,
        pendingCount: pending,
        todayNewCases: todayNew,
        todayCompleted: todayComp,
        totalRevenue: totalRev,
        monthRevenue: monthRev,
        weekRevenue: weekRev,
        avgDaysInService: serviceCount > 0 ? Math.round(totalServiceDays / serviceCount) : 0,
        urgentCount: urgent,
        mechanics: Array.from(mechanicSet),
      });

      // Recent cases: last 8, sorted by newest
      const recent: RecentCase[] = allCases
        .sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 8)
        .map((c: any) => ({
          id: c.id,
          plate: c.plate,
          carMake: c.carMake,
          carModel: c.carModel,
          customerName: c.customerName,
          totalPrice: c.totalPrice,
          status: c.status,
          statusId: c.statusId,
          repairStatus: c.repairStatus,
          daysAgo: Math.floor(
            (now.getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24)
          ),
          source: c.source,
          cpanelInvoiceId: c.cpanelInvoiceId,
        }));

      setRecentCases(recent);
    } catch (error) {
      console.error('[Dashboard] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // ─── Helpers ─────────────────────────────────────────────────
  const getStatusInfo = (status: string, statusId?: number) => {
    const completedStatuses = ['Completed', 'completed', 'დასრულებული'];
    if (completedStatuses.includes(status))
      return { label: 'დასრულებული', color: COLORS.success, icon: 'check-circle' };
    if (statusId === 7 || status === 'In Service' || status === 'Already in service')
      return { label: 'სერვისში', color: '#2196F3', icon: 'car-wrench' };
    if (status === 'Pending' || status === 'New')
      return { label: 'მომლოდინე', color: COLORS.warning, icon: 'clock-outline' };
    return { label: status, color: COLORS.text.tertiary, icon: 'file-document-outline' };
  };

  const getDaysLabel = (days: number): string => {
    if (days === 0) return 'დღეს';
    if (days === 1) return 'გუშინ';
    return `${days} დღის წინ`;
  };

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'დილა მშვიდობისა';
    if (hour < 18) return 'შუადღე მშვიდობისა';
    return 'საღამო მშვიდობისა';
  };

  const getTodayDate = (): string => {
    return new Date().toLocaleDateString('ka-GE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // ─── Navigation ──────────────────────────────────────────────
  const handleCreateCase = () => router.push('/cases/create');
  const handleQuickCapture = () => router.push('/capture/QuickCaptureScreen');
  const handlePlateScanner = () => router.push('/scan');
  const handleServiceSettings = () => router.push('/services/ServiceSettingsScreen');

  const handleCasePress = (c: RecentCase) => {
    if (c.source === 'cpanel') {
      router.push(`/cases/${c.cpanelInvoiceId}?source=cpanel`);
    } else {
      router.push(`/cases/${c.id}`);
    }
  };

  // ─── Loading State ──────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>დაშბორდის ჩატვირთვა...</Text>
      </View>
    );
  }

  // ─── Render ──────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* ─── Hero Header ───────────────────────────────────── */}
      <LinearGradient
        colors={[COLORS.primary, '#1E40AF']}
        style={styles.heroSection}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.greetingText}>{getGreeting()} 👋</Text>
            <Text style={styles.dateText}>{getTodayDate()}</Text>
          </View>
          <TouchableOpacity style={styles.settingsBtn} onPress={handleServiceSettings}>
            <MaterialCommunityIcons name="cog-outline" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Today Snapshot */}
        <View style={styles.todayBar}>
          <View style={styles.todayItem}>
            <View style={[styles.todayDot, { backgroundColor: COLORS.success }]} />
            <Text style={styles.todayLabel}>დღეს ახალი</Text>
            <Text style={styles.todayValue}>{stats.todayNewCases}</Text>
          </View>
          <View style={styles.todayDivider} />
          <View style={styles.todayItem}>
            <View style={[styles.todayDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.todayLabel}>დასრულებული</Text>
            <Text style={styles.todayValue}>{stats.todayCompleted}</Text>
          </View>
          <View style={styles.todayDivider} />
          <View style={styles.todayItem}>
            <View style={[styles.todayDot, { backgroundColor: COLORS.error }]} />
            <Text style={styles.todayLabel}>გადაუდებელი</Text>
            <Text style={styles.todayValue}>{stats.urgentCount}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* ─── KPI Cards ───────────────────────────────────── */}
        <View style={styles.kpiRow}>
          <TouchableOpacity
            style={styles.kpiCard}
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/cases')}
          >
            <View style={[styles.kpiIconWrap, { backgroundColor: '#2196F3' + '18' }]}>
              <MaterialCommunityIcons name="folder-open" size={22} color="#2196F3" />
            </View>
            <Text style={styles.kpiValue}>{stats.totalCases}</Text>
            <Text style={styles.kpiLabel}>სულ საქმეები</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kpiCard}
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/service')}
          >
            <View style={[styles.kpiIconWrap, { backgroundColor: COLORS.warning + '18' }]}>
              <MaterialCommunityIcons name="car-wrench" size={22} color={COLORS.warning} />
            </View>
            <Text style={styles.kpiValue}>{stats.inServiceCount}</Text>
            <Text style={styles.kpiLabel}>სერვისში</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kpiCard}
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/completed')}
          >
            <View style={[styles.kpiIconWrap, { backgroundColor: COLORS.success + '18' }]}>
              <MaterialCommunityIcons name="check-circle" size={22} color={COLORS.success} />
            </View>
            <Text style={styles.kpiValue}>{stats.completedCount}</Text>
            <Text style={styles.kpiLabel}>დასრულებული</Text>
          </TouchableOpacity>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconWrap, { backgroundColor: COLORS.accent + '18' }]}>
              <MaterialCommunityIcons name="clock-outline" size={22} color={COLORS.accent} />
            </View>
            <Text style={styles.kpiValue}>{stats.pendingCount}</Text>
            <Text style={styles.kpiLabel}>მომლოდინე</Text>
          </View>
        </View>

        {/* ─── Revenue Snapshot ─────────────────────────────── */}
        <View style={styles.revenueCard}>
          <View style={styles.revenueHeader}>
            <View style={styles.revenueHeaderLeft}>
              <MaterialCommunityIcons name="chart-line" size={20} color={COLORS.primary} />
              <Text style={styles.revenueSectionTitle}>შემოსავალი</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(tabs)/analytics')}>
              <Text style={styles.seeAllLink}>ანალიტიკა →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.revenueGrid}>
            <View style={styles.revenueItem}>
              <Text style={styles.revenuePeriod}>ამ კვირა</Text>
              <Text style={[styles.revenueAmount, { color: COLORS.success }]}>
                {formatCurrencyGEL(stats.weekRevenue)}
              </Text>
            </View>
            <View style={[styles.revenueItem, styles.revenueItemCenter]}>
              <Text style={styles.revenuePeriod}>ამ თვე</Text>
              <Text style={[styles.revenueAmount, { color: COLORS.primary }]}>
                {formatCurrencyGEL(stats.monthRevenue)}
              </Text>
            </View>
            <View style={styles.revenueItem}>
              <Text style={styles.revenuePeriod}>სულ</Text>
              <Text style={[styles.revenueAmount, { color: COLORS.accent }]}>
                {formatCurrencyGEL(stats.totalRevenue)}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── Quick Actions ───────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>⚡ სწრაფი მოქმედებები</Text>
        </View>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleCreateCase}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[COLORS.primary, '#1E40AF']}
              style={styles.actionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="plus-circle" size={28} color="#FFF" />
            </LinearGradient>
            <Text style={styles.actionLabel}>ახალი საქმე</Text>
            <Text style={styles.actionSubLabel}>საქმის შექმნა</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleQuickCapture}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[COLORS.secondary, '#059669']}
              style={styles.actionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="camera-plus" size={28} color="#FFF" />
            </LinearGradient>
            <Text style={styles.actionLabel}>ფოტო გადაღება</Text>
            <Text style={styles.actionSubLabel}>Quick Capture</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={handlePlateScanner}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#6366F1', '#4F46E5']}
              style={styles.actionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="car-search" size={28} color="#FFF" />
            </LinearGradient>
            <Text style={styles.actionLabel}>სკანერი</Text>
            <Text style={styles.actionSubLabel}>ნომრის ძებნა</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/cases')}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#2196F3', '#1976D2']}
              style={styles.actionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="folder-open" size={28} color="#FFF" />
            </LinearGradient>
            <Text style={styles.actionLabel}>საქმეები</Text>
            <Text style={styles.actionSubLabel}>ყველა საქმე</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/customers')}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              style={styles.actionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="account-group" size={28} color="#FFF" />
            </LinearGradient>
            <Text style={styles.actionLabel}>კლიენტები</Text>
            <Text style={styles.actionSubLabel}>ბაზის ნახვა</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Service Status Bar ──────────────────────────── */}
        {stats.inServiceCount > 0 && (
          <TouchableOpacity
            style={styles.serviceStatusBar}
            onPress={() => router.push('/(tabs)/service')}
            activeOpacity={0.7}
          >
            <View style={styles.serviceStatusLeft}>
              <View style={styles.serviceStatusPulse}>
                <MaterialCommunityIcons name="car-wrench" size={20} color="#FFF" />
              </View>
              <View>
                <Text style={styles.serviceStatusTitle}>
                  {stats.inServiceCount} მანქანა სერვისში
                </Text>
                <Text style={styles.serviceStatusSub}>
                  საშუალო: {stats.avgDaysInService} დღე • {stats.mechanics.length} მექანიკოსი
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        {/* ─── Mechanics Widget ─────────────────────────────── */}
        {stats.mechanics.length > 0 && (
          <View style={styles.mechanicsCard}>
            <View style={styles.mechanicsHeader}>
              <MaterialCommunityIcons
                name="account-hard-hat"
                size={18}
                color={COLORS.text.secondary}
              />
              <Text style={styles.mechanicsTitle}>აქტიური მექანიკოსები</Text>
            </View>
            <View style={styles.mechanicsChips}>
              {stats.mechanics.map((name, i) => (
                <View key={i} style={styles.mechanicChip}>
                  <View style={styles.mechanicAvatar}>
                    <Text style={styles.mechanicAvatarText}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.mechanicName} numberOfLines={1}>
                    {name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ─── Recent Cases ────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🕐 ბოლო საქმეები</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/cases')}>
            <Text style={styles.seeAllLink}>ყველა →</Text>
          </TouchableOpacity>
        </View>

        {recentCases.length === 0 ? (
          <View style={styles.emptyRecent}>
            <MaterialCommunityIcons
              name="folder-open-outline"
              size={40}
              color={COLORS.text.disabled}
            />
            <Text style={styles.emptyRecentText}>საქმეები ჯერ არ არის</Text>
          </View>
        ) : (
          recentCases.map((c, index) => {
            const statusInfo = getStatusInfo(c.status, c.statusId);
            return (
              <TouchableOpacity
                key={`${c.source}-${c.id}-${index}`}
                style={styles.recentCard}
                onPress={() => handleCasePress(c)}
                activeOpacity={0.7}
              >
                <View style={styles.recentLeft}>
                  <View
                    style={[styles.recentStatusDot, { backgroundColor: statusInfo.color }]}
                  />
                  <View style={styles.recentInfo}>
                    <View style={styles.recentTopRow}>
                      <Text style={styles.recentPlate}>{c.plate}</Text>
                      <Text style={styles.recentDays}>{getDaysLabel(c.daysAgo)}</Text>
                    </View>
                    <Text style={styles.recentVehicle} numberOfLines={1}>
                      {[c.carMake, c.carModel].filter(Boolean).join(' ') || 'ავტომობილი'}
                      {c.customerName ? `  •  ${c.customerName}` : ''}
                    </Text>
                    <View style={styles.recentBottomRow}>
                      <View
                        style={[
                          styles.recentStatusChip,
                          { backgroundColor: statusInfo.color + '18' },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={statusInfo.icon as any}
                          size={12}
                          color={statusInfo.color}
                        />
                        <Text style={[styles.recentStatusText, { color: statusInfo.color }]}>
                          {statusInfo.label}
                        </Text>
                      </View>
                      <Text style={styles.recentPrice}>
                        {formatCurrencyGEL(c.totalPrice)}
                      </Text>
                    </View>
                  </View>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={18}
                  color={COLORS.text.disabled}
                />
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ─── Floating Action Buttons ──────────────────────── */}
      <TouchableOpacity style={styles.fabSecondary} onPress={handlePlateScanner} activeOpacity={0.8}>
        <LinearGradient
          colors={['#6366F1', '#4F46E5']}
          style={styles.fabGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <MaterialCommunityIcons name="car-search" size={22} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.fabPrimary} onPress={handleQuickCapture} activeOpacity={0.8}>
        <LinearGradient
          colors={[COLORS.secondary, '#059669']}
          style={styles.fabGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <MaterialCommunityIcons name="camera-plus" size={22} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────
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
    fontSize: 15,
  },

  // ── Hero Header ───────────────────────────────────────────
  heroSection: {
    paddingTop: (StatusBar.currentHeight || 44) + 8,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Today Bar ─────────────────────────────────────────────
  todayBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  todayItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  todayLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600',
  },
  todayValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  todayDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  // ── ScrollView ────────────────────────────────────────────
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },

  // ── KPI Cards ─────────────────────────────────────────────
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  kpiIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text.primary,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text.tertiary,
    marginTop: 2,
    textAlign: 'center',
  },

  // ── Revenue Card ──────────────────────────────────────────
  revenueCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    ...SHADOWS.sm,
  },
  revenueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  revenueHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  revenueSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  revenueGrid: {
    flexDirection: 'row',
  },
  revenueItem: {
    flex: 1,
    alignItems: 'center',
  },
  revenueItemCenter: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.outline,
  },
  revenuePeriod: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text.tertiary,
    marginBottom: 4,
  },
  revenueAmount: {
    fontSize: 18,
    fontWeight: '800',
  },

  // ── Section Header ────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  seeAllLink: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // ── Quick Actions Grid ────────────────────────────────────
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  actionGradient: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  actionSubLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: COLORS.text.tertiary,
    textAlign: 'center',
    marginTop: -4,
  },

  // ── Service Status Bar ────────────────────────────────────
  serviceStatusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
    ...SHADOWS.sm,
  },
  serviceStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  serviceStatusPulse: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceStatusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  serviceStatusSub: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },

  // ── Mechanics Widget ──────────────────────────────────────
  mechanicsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    ...SHADOWS.sm,
  },
  mechanicsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  mechanicsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  mechanicsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mechanicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6366F118',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  mechanicAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mechanicAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  mechanicName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
    maxWidth: 100,
  },

  // ── Recent Cases ──────────────────────────────────────────
  emptyRecent: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyRecentText: {
    fontSize: 14,
    color: COLORS.text.disabled,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    ...SHADOWS.sm,
  },
  recentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  recentStatusDot: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  recentInfo: {
    flex: 1,
  },
  recentTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  recentPlate: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text.primary,
  },
  recentDays: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.text.tertiary,
  },
  recentVehicle: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    marginBottom: 6,
  },
  recentBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  recentStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  recentPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // ── FABs ──────────────────────────────────────────────────
  fabPrimary: {
    position: 'absolute',
    width: 52,
    height: 52,
    right: 20,
    bottom: 20,
    borderRadius: 16,
    ...SHADOWS.lg,
  },
  fabSecondary: {
    position: 'absolute',
    width: 52,
    height: 52,
    right: 20,
    bottom: 82,
    borderRadius: 16,
    ...SHADOWS.lg,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
