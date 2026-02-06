import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Card } from 'react-native-paper';
import { COLORS, TYPOGRAPHY } from '../../src/config/constants';

const SIZES = TYPOGRAPHY.fontSize;
const BORDER_COLOR = COLORS.outline;

const { width } = Dimensions.get('window');

interface AnalyticsData {
  totalRevenue: number;
  totalCases: number;
  activeCases: number;
  completedCases: number;
  preliminaryAssessmentCases: number;
  averageTicketValue: number;
  revenueGrowth: number;
  caseCompletionRate: number;
  averageProcessingTime: number;
  totalCustomers: number;
  repeatCustomerRate: number;

  // Time-based metrics
  revenueThisMonth: number;
  revenueLastMonth: number;
  casesThisMonth: number;
  casesLastMonth: number;

  // Top performers
  topServices: Array<{ name: string; count: number; revenue: number }>;
  topCustomers: Array<{ name: string; phone: string; totalSpent: number; casesCount: number }>;

  // Status breakdown
  statusBreakdown: Array<{ status: string; count: number; percentage: number }>;

  // Revenue by case type
  revenueByType: Array<{ type: string; revenue: number; percentage: number }>;
}

export default function AnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [dataSource, setDataSource] = useState<'all' | 'firebase' | 'cpanel'>('all');

  const loadAnalytics = useCallback(async () => {
    try {
      const { getAnalyticsData } = require('../../src/services/analyticsService');
      const analyticsData = await getAnalyticsData(selectedPeriod, dataSource);

      // Validate data before setting
      if (analyticsData && typeof analyticsData === 'object') {
        setData(analyticsData);
      } else {
        console.error('[Analytics] Invalid data received:', analyticsData);
        setData(null);
      }
    } catch (error) {
      console.error('[Analytics] Error loading data:', error);
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

  const handleRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  const formatCurrency = (amount: number) => {
    return `₾${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>ანალიტიკის ჩატვირთვა...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle" size={64} color={COLORS.text.disabled} />
        <Text style={styles.errorText}>მონაცემების ჩატვირთვა ვერ მოხერხდა</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[COLORS.primary, COLORS.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>ანალიტიკა</Text>
            <Text style={styles.headerSubtitle}>ბიზნეს მეტრიკები და ანგარიშები</Text>
          </View>
          <TouchableOpacity style={styles.exportButton}>
            <MaterialCommunityIcons name="file-export" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {(['week', 'month', 'year'] as const).map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period && styles.periodButtonActive,
              ]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  selectedPeriod === period && styles.periodButtonTextActive,
                ]}
              >
                {period === 'week' ? 'კვირა' : period === 'month' ? 'თვე' : 'წელი'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Data Source Selector */}
        <View style={styles.dataSourceSelector}>
          {(['all', 'firebase', 'cpanel'] as const).map((source) => (
            <TouchableOpacity
              key={source}
              style={[
                styles.sourceChip,
                dataSource === source && styles.sourceChipActive,
              ]}
              onPress={() => setDataSource(source)}
            >
              <Text
                style={[
                  styles.sourceChipText,
                  dataSource === source && styles.sourceChipTextActive,
                ]}
              >
                {source === 'all' ? 'ყველა' : source === 'firebase' ? 'Firebase' : 'CPanel'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Key Metrics Row */}
        <View style={styles.metricsRow}>
          <MetricCard
            icon="cash"
            label="მთლიანი შემოსავალი"
            value={formatCurrency(data.totalRevenue)}
            growth={data.revenueGrowth}
            color={COLORS.primary}
          />
          <MetricCard
            icon="briefcase"
            label="აქტიური საქმეები"
            value={data.activeCases.toString()}
            subValue={`${data.totalCases} სულ`}
            color={COLORS.secondary}
          />
        </View>

        <View style={styles.metricsRow}>
          <MetricCard
            icon="account-group"
            label="მთლიანი კლიენტები"
            value={data.totalCustomers.toString()}
            subValue={`${data.repeatCustomerRate.toFixed(0)}% განმეორებითი`}
            color={COLORS.accent}
          />
          <MetricCard
            icon="chart-line"
            label="საშუალო ბილეთი"
            value={formatCurrency(data.averageTicketValue)}
            growth={5.2}
            color="#F59E0B"
          />
        </View>

        {/* Revenue Trend Card */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <MaterialCommunityIcons name="trending-up" size={24} color={COLORS.primary} />
                <Text style={styles.cardTitle}>შემოსავლების ტენდენცია</Text>
              </View>
            </View>

            <View style={styles.revenueComparison}>
              <View style={styles.revenueItem}>
                <Text style={styles.revenueLabel}>ამ თვე</Text>
                <Text style={styles.revenueValue}>{formatCurrency(data.revenueThisMonth)}</Text>
                <Text style={styles.revenueCases}>{data.casesThisMonth} საქმე</Text>
              </View>
              <View style={styles.revenueDivider} />
              <View style={styles.revenueItem}>
                <Text style={styles.revenueLabel}>წინა თვე</Text>
                <Text style={styles.revenueValue}>{formatCurrency(data.revenueLastMonth)}</Text>
                <Text style={styles.revenueCases}>{data.casesLastMonth} საქმე</Text>
              </View>
            </View>

            <View style={styles.growthIndicator}>
              <MaterialCommunityIcons
                name={data.revenueGrowth >= 0 ? 'trending-up' : 'trending-down'}
                size={20}
                color={data.revenueGrowth >= 0 ? COLORS.success : COLORS.error}
              />
              <Text
                style={[
                  styles.growthText,
                  { color: data.revenueGrowth >= 0 ? COLORS.success : COLORS.error },
                ]}
              >
                {formatPercentage(data.revenueGrowth)} საპროცენტო ცვლილება
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Preliminary Assessment Cases - Special Card */}
        {data.preliminaryAssessmentCases > 0 && (
          <Card style={styles.card}>
            <LinearGradient
              colors={['#8B5CF6', '#6D28D9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.preliminaryCard}
            >
              <View style={styles.preliminaryCardContent}>
                <View style={styles.preliminaryIconContainer}>
                  <MaterialCommunityIcons name="clipboard-text-clock" size={32} color="#FFFFFF" />
                </View>
                <View style={styles.preliminaryTextContainer}>
                  <Text style={styles.preliminaryLabel}>წინასწარი შეფასება</Text>
                  <Text style={styles.preliminaryValue}>{data.preliminaryAssessmentCases}</Text>
                  <Text style={styles.preliminarySubtext}>
                    საქმე მოელის შეფასებას
                  </Text>
                </View>
                <View style={styles.preliminaryBadge}>
                  <MaterialCommunityIcons name="clock-outline" size={20} color="#FFFFFF" />
                </View>
              </View>
            </LinearGradient>
          </Card>
        )}

        {/* Status Breakdown */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <MaterialCommunityIcons name="chart-donut" size={24} color={COLORS.primary} />
                <Text style={styles.cardTitle}>საქმეების სტატუსი</Text>
              </View>
            </View>

            {data.statusBreakdown.map((item, index) => (
              <View key={index} style={styles.statusItem}>
                <View style={styles.statusInfo}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
                  <Text style={styles.statusLabel}>{item.status}</Text>
                </View>
                <View style={styles.statusValues}>
                  <Text style={styles.statusCount}>{item.count}</Text>
                  <Text style={styles.statusPercentage}>{item.percentage.toFixed(1)}%</Text>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Revenue by Case Type */}
        {data.revenueByType.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <MaterialCommunityIcons name="shape" size={24} color={COLORS.primary} />
                  <Text style={styles.cardTitle}>შემოსავალი საქმის ტიპის მიხედვით</Text>
                </View>
              </View>

              {data.revenueByType.map((item, index) => (
                <View key={index} style={styles.typeItem}>
                  <View style={styles.typeHeader}>
                    <MaterialCommunityIcons
                      name={item.type === 'დაზღვევა' ? 'shield-car' : 'cash'}
                      size={20}
                      color={item.type === 'დაზღვევა' ? COLORS.primary : COLORS.success}
                    />
                    <Text style={styles.typeLabel}>{item.type || 'არ არის მითითებული'}</Text>
                  </View>
                  <View style={styles.typeValues}>
                    <Text style={styles.typeRevenue}>{formatCurrency(item.revenue)}</Text>
                    <Text style={styles.typePercentage}>{item.percentage.toFixed(1)}%</Text>
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Top Services */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <MaterialCommunityIcons name="tools" size={24} color={COLORS.primary} />
                <Text style={styles.cardTitle}>ყველაზე მოთხოვნადი სერვისები</Text>
              </View>
            </View>

            {data.topServices.slice(0, 5).map((service, index) => (
              <View key={index} style={styles.topItem}>
                <View style={styles.topItemLeft}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>{index + 1}</Text>
                  </View>
                  <View>
                    <Text style={styles.topItemName}>{service.name}</Text>
                    <Text style={styles.topItemCount}>{service.count} ჯერ გამოყენებული</Text>
                  </View>
                </View>
                <Text style={styles.topItemValue}>{formatCurrency(service.revenue)}</Text>
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Top Customers */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <MaterialCommunityIcons name="star" size={24} color={COLORS.primary} />
                <Text style={styles.cardTitle}>ტოპ კლიენტები</Text>
              </View>
            </View>

            {data.topCustomers.slice(0, 5).map((customer, index) => (
              <View key={index} style={styles.customerItem}>
                <View style={styles.customerLeft}>
                  <View style={[styles.rankBadge, { backgroundColor: COLORS.secondary + '20' }]}>
                    <Text style={[styles.rankText, { color: COLORS.secondary }]}>{index + 1}</Text>
                  </View>
                  <View>
                    <Text style={styles.customerName}>{customer.name}</Text>
                    <Text style={styles.customerPhone}>{customer.phone}</Text>
                    <Text style={styles.customerCases}>{customer.casesCount} საქმე</Text>
                  </View>
                </View>
                <Text style={styles.customerSpent}>{formatCurrency(customer.totalSpent)}</Text>
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Performance Metrics */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <MaterialCommunityIcons name="speedometer" size={24} color={COLORS.primary} />
                <Text style={styles.cardTitle}>შესრულების მაჩვენებლები</Text>
              </View>
            </View>

            <View style={styles.performanceItem}>
              <View style={styles.performanceLabel}>
                <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.success} />
                <Text style={styles.performanceName}>დასრულების მაჩვენებელი</Text>
              </View>
              <Text style={styles.performanceValue}>{data.caseCompletionRate.toFixed(1)}%</Text>
            </View>

            <View style={styles.performanceItem}>
              <View style={styles.performanceLabel}>
                <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.primary} />
                <Text style={styles.performanceName}>საშუალო დამუშავების დრო</Text>
              </View>
              <Text style={styles.performanceValue}>{data.averageProcessingTime.toFixed(1)} დღე</Text>
            </View>

            <View style={styles.performanceItem}>
              <View style={styles.performanceLabel}>
                <MaterialCommunityIcons name="replay" size={20} color={COLORS.accent} />
                <Text style={styles.performanceName}>განმეორებითი კლიენტები</Text>
              </View>
              <Text style={styles.performanceValue}>{data.repeatCustomerRate.toFixed(1)}%</Text>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

// Helper Components
interface MetricCardProps {
  icon: string;
  label: string;
  value: string;
  growth?: number;
  subValue?: string;
  color: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, growth, subValue, color }) => {
  return (
    <Card style={styles.metricCard}>
      <LinearGradient
        colors={[color + '15', color + '05']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.metricGradient}
      >
        <View style={[styles.metricIcon, { backgroundColor: color + '20' }]}>
          <MaterialCommunityIcons name={icon as any} size={24} color={color} />
        </View>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
        {growth !== undefined && (
          <View style={styles.metricGrowth}>
            <MaterialCommunityIcons
              name={growth >= 0 ? 'trending-up' : 'trending-down'}
              size={16}
              color={growth >= 0 ? COLORS.success : COLORS.error}
            />
            <Text style={[styles.metricGrowthText, { color: growth >= 0 ? COLORS.success : COLORS.error }]}>
              {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
            </Text>
          </View>
        )}
        {subValue && <Text style={styles.metricSubValue}>{subValue}</Text>}
      </LinearGradient>
    </Card>
  );
};

const getStatusColor = (status: string): string => {
  const statusMap: { [key: string]: string } = {
    'New': COLORS.primary,
    'Processing': '#F59E0B',
    'Already in service': COLORS.secondary,
    'Completed': COLORS.success,
    'Cancelled': COLORS.error,
  };
  return statusMap[status] || COLORS.text.disabled;
};

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
    fontSize: SIZES.md,
    color: COLORS.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: SIZES.md,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: SIZES.sm,
    color: '#fff',
    opacity: 0.9,
  },
  exportButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#fff',
  },
  periodButtonText: {
    fontSize: SIZES.sm,
    fontWeight: '600',
    color: '#fff',
  },
  periodButtonTextActive: {
    color: COLORS.primary,
  },
  dataSourceSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  sourceChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  sourceChipActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  sourceChipText: {
    fontSize: SIZES.xs,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.8,
  },
  sourceChipTextActive: {
    opacity: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 2,
  },
  metricGradient: {
    padding: 16,
  },
  metricIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: SIZES.xs,
    color: COLORS.text.secondary,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: SIZES.xl,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  metricGrowth: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricGrowthText: {
    fontSize: SIZES.xs,
    fontWeight: '600',
  },
  metricSubValue: {
    fontSize: SIZES.xs,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  card: {
    marginBottom: 16,
    borderRadius: 20,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 20,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardTitle: {
    fontSize: SIZES.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  revenueComparison: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  revenueItem: {
    flex: 1,
    alignItems: 'center',
  },
  revenueLabel: {
    fontSize: SIZES.sm,
    color: COLORS.text.secondary,
    marginBottom: 8,
  },
  revenueValue: {
    fontSize: SIZES['2xl'],
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  revenueCases: {
    fontSize: SIZES.xs,
    color: COLORS.text.secondary,
  },
  revenueDivider: {
    width: 1,
    backgroundColor: BORDER_COLOR,
    marginHorizontal: 20,
  },
  growthIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.success + '10',
    borderRadius: 12,
  },
  growthText: {
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusLabel: {
    fontSize: SIZES.md,
    color: COLORS.text.primary,
  },
  statusValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusCount: {
    fontSize: SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  statusPercentage: {
    fontSize: SIZES.sm,
    color: COLORS.text.secondary,
    minWidth: 50,
    textAlign: 'right',
  },
  typeItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  typeLabel: {
    fontSize: SIZES.md,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  typeValues: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeRevenue: {
    fontSize: SIZES.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  typePercentage: {
    fontSize: SIZES.sm,
    color: COLORS.text.secondary,
  },
  topItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  topItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: SIZES.sm,
    fontWeight: '700',
    color: COLORS.primary,
  },
  topItemName: {
    fontSize: SIZES.md,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  topItemCount: {
    fontSize: SIZES.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  topItemValue: {
    fontSize: SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  customerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  customerName: {
    fontSize: SIZES.md,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  customerPhone: {
    fontSize: SIZES.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  customerCases: {
    fontSize: SIZES.xs,
    color: COLORS.accent,
    marginTop: 2,
  },
  customerSpent: {
    fontSize: SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  performanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  performanceLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  performanceName: {
    fontSize: SIZES.md,
    color: COLORS.text.primary,
  },
  performanceValue: {
    fontSize: SIZES.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  bottomSpacer: {
    height: 40,
  },
  // Preliminary Assessment Card Styles
  preliminaryCard: {
    borderRadius: 12,
    padding: 20,
    minHeight: 120,
  },
  preliminaryCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  preliminaryIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  preliminaryTextContainer: {
    flex: 1,
  },
  preliminaryLabel: {
    fontSize: SIZES.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    marginBottom: 4,
  },
  preliminaryValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  preliminarySubtext: {
    fontSize: SIZES.xs,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  preliminaryBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
