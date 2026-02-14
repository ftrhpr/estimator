import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    type DimensionValue,
} from 'react-native';
import { COLORS, TYPOGRAPHY } from '../../src/config/constants';
import type { AnalyticsData } from '../../src/services/analyticsService';

const SIZES = TYPOGRAPHY.fontSize;
const { width: SCREEN_W } = Dimensions.get('window');

// ─── Section IDs for collapsible cards ───────────────────
type Section =
  | 'revenue'
  | 'status'
  | 'repairStatus'
  | 'trend'
  | 'services'
  | 'customers'
  | 'mechanics'
  | 'caseType'
  | 'payments'
  | 'performance';

// ─── Colour palette for status badges / bars ─────────────
const STATUS_COLORS: Record<string, string> = {
  New: '#3B82F6',
  'Already in service': '#F59E0B',
  Processing: '#F59E0B',
  'In Service': '#F59E0B',
  Completed: '#10B981',
  'დასრულებული': '#10B981',
  Cancelled: '#EF4444',
  'გაუქმებული': '#EF4444',
  'წინასწარი შეფასება': '#8B5CF6',
};

const REPAIR_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#6366F1'];
const BAR_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#EF4444', '#6366F1', '#F97316', '#06B6D4'];

export default function AnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [dataSource, setDataSource] = useState<'all' | 'firebase' | 'cpanel'>('all');
  const [collapsed, setCollapsed] = useState<Record<Section, boolean>>({
    revenue: false,
    status: false,
    repairStatus: true,
    trend: false,
    services: false,
    customers: false,
    mechanics: false,
    caseType: true,
    payments: false,
    performance: false,
  });

  const toggle = (s: Section) => setCollapsed((p) => ({ ...p, [s]: !p[s] }));

  const loadAnalytics = useCallback(async () => {
    try {
      const { getAnalyticsData } = require('../../src/services/analyticsService');
      const d = await getAnalyticsData(selectedPeriod, dataSource);
      if (d && typeof d === 'object') setData(d);
      else setData(null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod, dataSource]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadAnalytics();
    }, [loadAnalytics])
  );

  const fmt = (n: number) => `₾${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

  // ── Loading / Error ──
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={s.loadingTxt}>ანალიტიკის ჩატვირთვა...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={s.center}>
        <MaterialCommunityIcons name="alert-circle" size={64} color={COLORS.text.disabled} />
        <Text style={s.loadingTxt}>მონაცემების ჩატვირთვა ვერ მოხერხდა</Text>
      </View>
    );
  }

  const maxTrendRev = Math.max(...data.monthlyTrend.map((m) => m.revenue), 1);

  return (
    <View style={s.root}>
      {/* ──── HEADER ──── */}
      <LinearGradient colors={['#1E3A5F', '#2563EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerTitle}>📊 ანალიტიკა</Text>
            <Text style={s.headerSub}>ბიზნეს მეტრიკები და ანგარიშები</Text>
          </View>
        </View>

        {/* Period pills */}
        <View style={s.pills}>
          {(['week', 'month', 'year'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[s.pill, selectedPeriod === p && s.pillActive]}
              onPress={() => setSelectedPeriod(p)}
            >
              <Text style={[s.pillTxt, selectedPeriod === p && s.pillTxtActive]}>
                {p === 'week' ? 'კვირა' : p === 'month' ? 'თვე' : 'წელი'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Data source chips */}
        <View style={s.chips}>
          {(['all', 'firebase', 'cpanel'] as const).map((src) => (
            <TouchableOpacity
              key={src}
              style={[s.chip, dataSource === src && s.chipActive]}
              onPress={() => setDataSource(src)}
            >
              <Text style={[s.chipTxt, dataSource === src && s.chipTxtActive]}>
                {src === 'all' ? 'ყველა' : src === 'firebase' ? 'Firebase' : 'CPanel'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAnalytics(); }} colors={[COLORS.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ──── KEY METRICS GRID ──── */}
        <View style={s.grid}>
          <KPI icon="cash-multiple" label="მთლიანი შემოსავალი" value={fmt(data.totalRevenue)} delta={data.revenueGrowth} color="#2563EB" />
          <KPI icon="briefcase-outline" label="სულ საქმეები" value={data.totalCases.toString()} sub={`${data.activeCases} აქტიური`} color="#10B981" />
          <KPI icon="account-group-outline" label="კლიენტები" value={data.totalCustomers.toString()} sub={`${data.newCustomersThisPeriod} ახალი`} color="#8B5CF6" />
          <KPI icon="receipt" label="საშ. ბილეთი" value={fmt(data.averageTicketValue)} delta={data.averageTicketGrowth} color="#F59E0B" />
        </View>

        {/* ──── REVENUE COMPARISON ──── */}
        <CollapsibleCard icon="trending-up" title="შემოსავლების შედარება" section="revenue" collapsed={collapsed.revenue} toggle={toggle}>
          <View style={s.compareRow}>
            <View style={s.compareBox}>
              <Text style={s.compareLbl}>ეს პერიოდი</Text>
              <Text style={s.compareVal}>{fmt(data.revenueThisPeriod)}</Text>
              <Text style={s.compareSub}>{data.casesThisPeriod} საქმე</Text>
            </View>
            <View style={s.compareDivider} />
            <View style={s.compareBox}>
              <Text style={s.compareLbl}>წინა პერიოდი</Text>
              <Text style={s.compareVal}>{fmt(data.revenuePreviousPeriod)}</Text>
              <Text style={s.compareSub}>{data.casesPreviousPeriod} საქმე</Text>
            </View>
          </View>
          <View style={[s.growthBanner, { backgroundColor: data.revenueGrowth >= 0 ? '#ECFDF5' : '#FEF2F2' }]}>
            <MaterialCommunityIcons name={data.revenueGrowth >= 0 ? 'trending-up' : 'trending-down'} size={18} color={data.revenueGrowth >= 0 ? COLORS.success : COLORS.error} />
            <Text style={[s.growthBannerTxt, { color: data.revenueGrowth >= 0 ? COLORS.success : COLORS.error }]}>{pct(data.revenueGrowth)} ცვლილება</Text>
          </View>

          {/* Services vs Parts split */}
          {(data.serviceRevenue > 0 || data.partsRevenue > 0) && (
            <View style={s.splitRow}>
              <View style={s.splitItem}>
                <View style={[s.splitDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={s.splitLbl}>სერვისები</Text>
                <Text style={s.splitVal}>{fmt(data.serviceRevenue)}</Text>
              </View>
              <View style={s.splitItem}>
                <View style={[s.splitDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={s.splitLbl}>ნაწილები</Text>
                <Text style={s.splitVal}>{fmt(data.partsRevenue)}</Text>
              </View>
            </View>
          )}
        </CollapsibleCard>

        {/* ──── MONTHLY TREND ──── */}
        <CollapsibleCard icon="chart-bar" title="თვიური ტენდენცია (12 თვე)" section="trend" collapsed={collapsed.trend} toggle={toggle}>
          <View style={s.barChart}>
            {data.monthlyTrend.map((m, i) => {
              const h = maxTrendRev > 0 ? (m.revenue / maxTrendRev) * 120 : 0;
              const isActive = m.cases > 0;
              return (
                <View key={m.month} style={s.barCol}>
                  <Text style={s.barVal}>{m.cases > 0 ? (m.revenue >= 1000 ? `${(m.revenue / 1000).toFixed(0)}k` : m.revenue.toFixed(0)) : ''}</Text>
                  <View style={[s.bar, { height: Math.max(h, 3), backgroundColor: isActive ? '#3B82F6' : '#E2E8F0' }]} />
                  <Text style={s.barLbl}>{m.label}</Text>
                </View>
              );
            })}
          </View>
          <View style={s.barLegend}>
            <Text style={s.barLegendTxt}>📈 {data.monthlyTrend.filter((m) => m.cases > 0).length} აქტიური თვე | სულ {data.monthlyTrend.reduce((s, m) => s + m.cases, 0)} საქმე</Text>
          </View>
        </CollapsibleCard>

        {/* ──── PAYMENTS / CASH FLOW ──── */}
        {data.payments.totalInvoiced > 0 && (
          <CollapsibleCard icon="cash-check" title="ფულადი ნაკადი" section="payments" collapsed={collapsed.payments} toggle={toggle}>
            <View style={s.cashGrid}>
              <View style={[s.cashBox, { backgroundColor: '#ECFDF5' }]}>
                <MaterialCommunityIcons name="arrow-down-circle" size={24} color="#10B981" />
                <Text style={s.cashLabel}>შეგროვებული</Text>
                <Text style={[s.cashValue, { color: '#10B981' }]}>{fmt(data.payments.totalCollected)}</Text>
              </View>
              <View style={[s.cashBox, { backgroundColor: '#FEF3C7' }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#F59E0B" />
                <Text style={s.cashLabel}>დავალიანება</Text>
                <Text style={[s.cashValue, { color: '#F59E0B' }]}>{fmt(data.payments.totalOutstanding)}</Text>
              </View>
            </View>

            {/* Collection rate bar */}
            <View style={s.rateRow}>
              <Text style={s.rateLbl}>შეგროვების მაჩვენებელი</Text>
              <Text style={s.rateVal}>{data.payments.collectionRate.toFixed(1)}%</Text>
            </View>
            <View style={s.rateBarBg}>
              <View style={[s.rateBarFill, { width: `${Math.min(data.payments.collectionRate, 100)}%` }]} />
            </View>

            {/* Payment method breakdown */}
            {data.payments.methodBreakdown.length > 0 && (
              <View style={s.methodSection}>
                <Text style={s.methodTitle}>გადახდის მეთოდი</Text>
                {data.payments.methodBreakdown.map((m, i) => (
                  <View key={m.method} style={s.methodRow}>
                    <View style={[s.methodDot, { backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }]} />
                    <Text style={s.methodName}>{m.method}</Text>
                    <Text style={s.methodAmt}>{fmt(m.amount)}</Text>
                    <Text style={s.methodPct}>{m.percentage.toFixed(0)}%</Text>
                  </View>
                ))}
              </View>
            )}
          </CollapsibleCard>
        )}

        {/* ──── PRELIMINARY ASSESSMENT ──── */}
        {data.preliminaryAssessmentCases > 0 && (
          <LinearGradient colors={['#8B5CF6', '#6D28D9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.prelimCard}>
            <View style={s.prelimRow}>
              <View style={s.prelimIcon}>
                <MaterialCommunityIcons name="clipboard-text-clock" size={28} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.prelimLabel}>წინასწარი შეფასება</Text>
                <Text style={s.prelimValue}>{data.preliminaryAssessmentCases}</Text>
                <Text style={s.prelimSub}>საქმე მოელის შეფასებას</Text>
              </View>
            </View>
          </LinearGradient>
        )}

        {/* ──── STATUS BREAKDOWN ──── */}
        <CollapsibleCard icon="chart-donut" title="საქმეების სტატუსი" section="status" collapsed={collapsed.status} toggle={toggle}>
          {data.statusBreakdown.map((item) => {
            const color = STATUS_COLORS[item.status] || COLORS.text.disabled;
            const barW: DimensionValue = item.percentage > 0 ? `${item.percentage}%` : '0%';
            return (
              <View key={item.status} style={s.statusRow}>
                <View style={s.statusInfo}>
                  <View style={[s.statusDot, { backgroundColor: color }]} />
                  <Text style={s.statusName} numberOfLines={1}>{item.status}</Text>
                </View>
                <View style={s.statusBarBg}>
                  <View style={[s.statusBarFill, { width: barW, backgroundColor: color }]} />
                </View>
                <Text style={s.statusCount}>{item.count}</Text>
                <Text style={s.statusPct}>{item.percentage.toFixed(1)}%</Text>
              </View>
            );
          })}
        </CollapsibleCard>

        {/* ──── REPAIR STATUS ──── */}
        {data.repairStatusBreakdown.length > 0 && (
          <CollapsibleCard icon="wrench" title="შეკეთების სტატუსი" section="repairStatus" collapsed={collapsed.repairStatus} toggle={toggle}>
            {data.repairStatusBreakdown.map((item, i) => {
              const color = REPAIR_COLORS[i % REPAIR_COLORS.length];
              return (
                <View key={item.status} style={s.statusRow}>
                  <View style={s.statusInfo}>
                    <View style={[s.statusDot, { backgroundColor: color }]} />
                    <Text style={s.statusName} numberOfLines={1}>{item.status}</Text>
                  </View>
                  <View style={s.statusBarBg}>
                    <View style={[s.statusBarFill, { width: `${item.percentage}%`, backgroundColor: color }]} />
                  </View>
                  <Text style={s.statusCount}>{item.count}</Text>
                  <Text style={s.statusPct}>{item.percentage.toFixed(1)}%</Text>
                </View>
              );
            })}
          </CollapsibleCard>
        )}

        {/* ──── REVENUE BY TYPE ──── */}
        {data.revenueByType.length > 0 && (
          <CollapsibleCard icon="shape" title="შემოსავალი ტიპის მიხედვით" section="caseType" collapsed={collapsed.caseType} toggle={toggle}>
            {data.revenueByType.map((item, i) => (
              <View key={item.type} style={s.typeRow}>
                <View style={s.typeLeft}>
                  <MaterialCommunityIcons
                    name={item.type === 'დაზღვევა' ? 'shield-car' : item.type === 'ნაღდი' ? 'cash' : 'tag-outline'}
                    size={20}
                    color={BAR_COLORS[i % BAR_COLORS.length]}
                  />
                  <View>
                    <Text style={s.typeName}>{item.type}</Text>
                    <Text style={s.typeCount}>{item.count} საქმე</Text>
                  </View>
                </View>
                <View style={s.typeRight}>
                  <Text style={s.typeAmt}>{fmt(item.revenue)}</Text>
                  <Text style={s.typePct}>{item.percentage.toFixed(1)}%</Text>
                </View>
              </View>
            ))}
          </CollapsibleCard>
        )}

        {/* ──── TOP SERVICES ──── */}
        <CollapsibleCard icon="tools" title="ტოპ სერვისები" section="services" collapsed={collapsed.services} toggle={toggle}>
          {data.topServices.length === 0 && <Text style={s.emptyTxt}>სერვისების მონაცემები არ არის</Text>}
          {data.topServices.slice(0, 7).map((svc, i) => {
            const maxRev = data.topServices[0]?.revenue || 1;
            const barW: DimensionValue = `${(svc.revenue / maxRev) * 100}%`;
            return (
              <View key={svc.name} style={s.svcRow}>
                <View style={s.svcLeft}>
                  <View style={[s.rank, { backgroundColor: i < 3 ? '#FEF3C7' : '#F1F5F9' }]}>
                    <Text style={[s.rankTxt, { color: i < 3 ? '#D97706' : COLORS.text.secondary }]}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.svcName} numberOfLines={1}>{svc.name}</Text>
                    <Text style={s.svcSub}>{svc.count}x გამოყენებული</Text>
                  </View>
                </View>
                <View style={s.svcRight}>
                  <Text style={s.svcAmt}>{fmt(svc.revenue)}</Text>
                  <View style={s.svcBarBg}>
                    <View style={[s.svcBarFill, { width: barW, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }]} />
                  </View>
                </View>
              </View>
            );
          })}
        </CollapsibleCard>

        {/* ──── TOP CUSTOMERS ──── */}
        <CollapsibleCard icon="star" title="ტოპ კლიენტები" section="customers" collapsed={collapsed.customers} toggle={toggle}>
          {data.topCustomers.length === 0 && <Text style={s.emptyTxt}>კლიენტების მონაცემები არ არის</Text>}
          {data.topCustomers.slice(0, 7).map((c, i) => (
            <View key={c.phone} style={s.custRow}>
              <View style={s.custLeft}>
                <View style={[s.rank, { backgroundColor: '#EEF2FF' }]}>
                  <Text style={[s.rankTxt, { color: '#4F46E5' }]}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.custName} numberOfLines={1}>{c.name}</Text>
                  <Text style={s.custPhone}>{c.phone}</Text>
                </View>
              </View>
              <View style={s.custRight}>
                <Text style={s.custAmt}>{fmt(c.totalSpent)}</Text>
                <Text style={s.custCases}>{c.casesCount} საქმე</Text>
              </View>
            </View>
          ))}
        </CollapsibleCard>

        {/* ──── MECHANIC PERFORMANCE ──── */}
        {data.mechanicStats.length > 0 && (
          <CollapsibleCard icon="account-hard-hat" title="მექანიკოსების შედეგები" section="mechanics" collapsed={collapsed.mechanics} toggle={toggle}>
            {data.mechanicStats.map((m, i) => {
              const completionRate = m.casesCount > 0 ? (m.completedCount / m.casesCount) * 100 : 0;
              return (
                <View key={m.name} style={s.mechRow}>
                  <View style={s.mechHeader}>
                    <View style={s.mechLeft}>
                      <View style={[s.mechAvatar, { backgroundColor: BAR_COLORS[i % BAR_COLORS.length] + '20' }]}>
                        <MaterialCommunityIcons name="account" size={20} color={BAR_COLORS[i % BAR_COLORS.length]} />
                      </View>
                      <Text style={s.mechName} numberOfLines={1}>{m.name}</Text>
                    </View>
                    <Text style={s.mechRev}>{fmt(m.revenue)}</Text>
                  </View>
                  <View style={s.mechStats}>
                    <View style={s.mechStat}>
                      <Text style={s.mechStatVal}>{m.casesCount}</Text>
                      <Text style={s.mechStatLbl}>სულ</Text>
                    </View>
                    <View style={s.mechStat}>
                      <Text style={[s.mechStatVal, { color: COLORS.success }]}>{m.completedCount}</Text>
                      <Text style={s.mechStatLbl}>დასრული.</Text>
                    </View>
                    <View style={s.mechStat}>
                      <Text style={[s.mechStatVal, { color: '#F59E0B' }]}>{m.activeCases}</Text>
                      <Text style={s.mechStatLbl}>აქტიური</Text>
                    </View>
                    <View style={s.mechStat}>
                      <Text style={[s.mechStatVal, { color: COLORS.primary }]}>{completionRate.toFixed(0)}%</Text>
                      <Text style={s.mechStatLbl}>დასრ. %</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </CollapsibleCard>
        )}

        {/* ──── PERFORMANCE METRICS ──── */}
        <CollapsibleCard icon="speedometer" title="შესრულების მაჩვენებლები" section="performance" collapsed={collapsed.performance} toggle={toggle}>
          <PerfRow icon="check-circle" color={COLORS.success} label="დასრულების მაჩვენებელი" value={`${data.caseCompletionRate.toFixed(1)}%`} />
          <PerfRow icon="clock-outline" color={COLORS.primary} label="საშ. დამუშავების დრო" value={data.averageProcessingDays > 0 ? `${data.averageProcessingDays.toFixed(1)} დღე` : '—'} />
          <PerfRow icon="replay" color={COLORS.accent} label="განმეორებითი კლიენტები" value={`${data.repeatCustomerRate.toFixed(1)}%`} />
          <PerfRow icon="cancel" color={COLORS.error} label="გაუქმებული საქმეები" value={data.cancelledCases.toString()} />
          {data.vatCollected > 0 && <PerfRow icon="percent" color="#14B8A6" label="დღგ შეგროვებული" value={fmt(data.vatCollected)} />}
          {data.totalDiscountGiven > 0 && <PerfRow icon="tag-minus" color="#EC4899" label="სულ ფასდაკლება" value={fmt(data.totalDiscountGiven)} />}
        </CollapsibleCard>

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

// ─── SUB-COMPONENTS ─────────────────────────────────────

interface KPIProps {
  icon: string;
  label: string;
  value: string;
  delta?: number;
  sub?: string;
  color: string;
}

const KPI: React.FC<KPIProps> = ({ icon, label, value, delta, sub, color }) => (
  <View style={[s.kpi, { borderLeftColor: color, borderLeftWidth: 3 }]}>
    <View style={[s.kpiIcon, { backgroundColor: color + '15' }]}>
      <MaterialCommunityIcons name={icon as any} size={22} color={color} />
    </View>
    <Text style={s.kpiLabel}>{label}</Text>
    <Text style={s.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    {delta !== undefined && delta !== 0 && (
      <View style={s.kpiDelta}>
        <MaterialCommunityIcons name={delta >= 0 ? 'arrow-up' : 'arrow-down'} size={12} color={delta >= 0 ? COLORS.success : COLORS.error} />
        <Text style={[s.kpiDeltaTxt, { color: delta >= 0 ? COLORS.success : COLORS.error }]}>{Math.abs(delta).toFixed(1)}%</Text>
      </View>
    )}
    {sub && <Text style={s.kpiSub}>{sub}</Text>}
  </View>
);

interface CollapsibleProps {
  icon: string;
  title: string;
  section: Section;
  collapsed: boolean;
  toggle: (s: Section) => void;
  children: React.ReactNode;
}

const CollapsibleCard: React.FC<CollapsibleProps> = ({ icon, title, section, collapsed, toggle, children }) => (
  <View style={s.card}>
    <TouchableOpacity style={s.cardHeader} onPress={() => toggle(section)} activeOpacity={0.7}>
      <View style={s.cardTitleRow}>
        <MaterialCommunityIcons name={icon as any} size={22} color={COLORS.primary} />
        <Text style={s.cardTitle}>{title}</Text>
      </View>
      <MaterialCommunityIcons name={collapsed ? 'chevron-down' : 'chevron-up'} size={22} color={COLORS.text.tertiary} />
    </TouchableOpacity>
    {!collapsed && <View style={s.cardBody}>{children}</View>}
  </View>
);

interface PerfRowProps { icon: string; color: string; label: string; value: string }
const PerfRow: React.FC<PerfRowProps> = ({ icon, color, label, value }) => (
  <View style={s.perfRow}>
    <View style={s.perfLeft}>
      <MaterialCommunityIcons name={icon as any} size={20} color={color} />
      <Text style={s.perfLabel}>{label}</Text>
    </View>
    <Text style={s.perfValue}>{value}</Text>
  </View>
);

// ─── STYLES ─────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  loadingTxt: { marginTop: 16, fontSize: SIZES.base, color: COLORS.text.secondary },

  // Header
  header: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: SIZES.sm, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  // Pills
  pills: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 3, marginBottom: 12 },
  pill: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 11 },
  pillActive: { backgroundColor: '#fff' },
  pillTxt: { fontSize: SIZES.sm, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  pillTxtActive: { color: '#2563EB' },

  // Chips
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  chipActive: { backgroundColor: 'rgba(255,255,255,0.32)' },
  chipTxt: { fontSize: SIZES.xs, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  chipTxtActive: { color: '#fff' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 20 },

  // KPI grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  kpi: {
    width: (SCREEN_W - 42) / 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  kpiIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  kpiLabel: { fontSize: 11, color: COLORS.text.tertiary, fontWeight: '500', marginBottom: 4 },
  kpiValue: { fontSize: 20, fontWeight: '700', color: COLORS.text.primary },
  kpiDelta: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  kpiDeltaTxt: { fontSize: 11, fontWeight: '600' },
  kpiSub: { fontSize: 11, color: COLORS.text.secondary, marginTop: 4 },

  // Card
  card: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: SIZES.base, fontWeight: '600', color: COLORS.text.primary },
  cardBody: { paddingHorizontal: 16, paddingBottom: 16 },

  // Revenue comparison
  compareRow: { flexDirection: 'row', marginBottom: 14 },
  compareBox: { flex: 1, alignItems: 'center' },
  compareLbl: { fontSize: SIZES.xs, color: COLORS.text.secondary, marginBottom: 6 },
  compareVal: { fontSize: 22, fontWeight: '700', color: COLORS.text.primary },
  compareSub: { fontSize: 11, color: COLORS.text.tertiary, marginTop: 4 },
  compareDivider: { width: 1, backgroundColor: '#E2E8F0', marginHorizontal: 16 },
  growthBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 10, marginBottom: 14 },
  growthBannerTxt: { fontSize: SIZES.sm, fontWeight: '600' },

  // Split row (services vs parts)
  splitRow: { flexDirection: 'row', gap: 12 },
  splitItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10 },
  splitDot: { width: 10, height: 10, borderRadius: 5 },
  splitLbl: { fontSize: 11, color: COLORS.text.secondary },
  splitVal: { fontSize: 13, fontWeight: '600', color: COLORS.text.primary, marginLeft: 'auto' },

  // Bar chart
  barChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160, gap: 2, marginBottom: 8 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barVal: { fontSize: 8, color: COLORS.text.tertiary, marginBottom: 3 },
  bar: { width: '75%', borderRadius: 4, minHeight: 3 },
  barLbl: { fontSize: 9, color: COLORS.text.secondary, marginTop: 4 },
  barLegend: { alignItems: 'center', paddingTop: 4 },
  barLegendTxt: { fontSize: 11, color: COLORS.text.tertiary },

  // Cash flow
  cashGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  cashBox: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center', gap: 6 },
  cashLabel: { fontSize: 11, color: COLORS.text.secondary },
  cashValue: { fontSize: 18, fontWeight: '700' },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rateLbl: { fontSize: 12, color: COLORS.text.secondary },
  rateVal: { fontSize: 12, fontWeight: '600', color: COLORS.text.primary },
  rateBarBg: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden', marginBottom: 14 },
  rateBarFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 4 },
  methodSection: { marginTop: 4 },
  methodTitle: { fontSize: 12, fontWeight: '600', color: COLORS.text.secondary, marginBottom: 8 },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  methodDot: { width: 8, height: 8, borderRadius: 4 },
  methodName: { flex: 1, fontSize: 13, color: COLORS.text.primary },
  methodAmt: { fontSize: 13, fontWeight: '600', color: COLORS.text.primary },
  methodPct: { fontSize: 11, color: COLORS.text.tertiary, width: 36, textAlign: 'right' },

  // Preliminary
  prelimCard: { borderRadius: 16, padding: 18, marginBottom: 12 },
  prelimRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  prelimIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  prelimLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  prelimValue: { fontSize: 32, fontWeight: '700', color: '#fff' },
  prelimSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },

  // Status breakdown
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  statusInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 130 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusName: { fontSize: 12, color: COLORS.text.primary, flex: 1 },
  statusBarBg: { flex: 1, height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  statusBarFill: { height: '100%', borderRadius: 4 },
  statusCount: { fontSize: 13, fontWeight: '600', color: COLORS.text.primary, width: 28, textAlign: 'right' },
  statusPct: { fontSize: 11, color: COLORS.text.tertiary, width: 40, textAlign: 'right' },

  // Revenue by type
  typeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F1F5F9' },
  typeLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeName: { fontSize: 13, fontWeight: '500', color: COLORS.text.primary },
  typeCount: { fontSize: 11, color: COLORS.text.tertiary },
  typeRight: { alignItems: 'flex-end' },
  typeAmt: { fontSize: 14, fontWeight: '600', color: COLORS.text.primary },
  typePct: { fontSize: 11, color: COLORS.text.tertiary },

  // Services
  emptyTxt: { fontSize: 13, color: COLORS.text.tertiary, textAlign: 'center', paddingVertical: 20 },
  svcRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F1F5F9' },
  svcLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 10 },
  rank: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  rankTxt: { fontSize: 12, fontWeight: '700' },
  svcName: { fontSize: 13, fontWeight: '500', color: COLORS.text.primary },
  svcSub: { fontSize: 10, color: COLORS.text.tertiary, marginTop: 1 },
  svcRight: { alignItems: 'flex-end', minWidth: 80 },
  svcAmt: { fontSize: 13, fontWeight: '600', color: COLORS.text.primary, marginBottom: 4 },
  svcBarBg: { width: 80, height: 5, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  svcBarFill: { height: '100%', borderRadius: 3 },

  // Customers
  custRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F1F5F9' },
  custLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 10 },
  custName: { fontSize: 13, fontWeight: '500', color: COLORS.text.primary },
  custPhone: { fontSize: 11, color: COLORS.text.tertiary, marginTop: 1 },
  custRight: { alignItems: 'flex-end' },
  custAmt: { fontSize: 14, fontWeight: '600', color: COLORS.text.primary },
  custCases: { fontSize: 11, color: COLORS.accent, marginTop: 2 },

  // Mechanics
  mechRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F1F5F9' },
  mechHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  mechLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  mechAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  mechName: { fontSize: 14, fontWeight: '600', color: COLORS.text.primary },
  mechRev: { fontSize: 14, fontWeight: '700', color: COLORS.text.primary },
  mechStats: { flexDirection: 'row', gap: 8 },
  mechStat: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 8, alignItems: 'center' },
  mechStatVal: { fontSize: 16, fontWeight: '700', color: COLORS.text.primary },
  mechStatLbl: { fontSize: 9, color: COLORS.text.tertiary, marginTop: 2 },

  // Performance
  perfRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F1F5F9' },
  perfLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  perfLabel: { fontSize: 13, color: COLORS.text.primary },
  perfValue: { fontSize: 16, fontWeight: '600', color: COLORS.text.primary },
});
