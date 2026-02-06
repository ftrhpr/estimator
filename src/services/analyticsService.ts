/**
 * Analytics Service
 * Aggregates data from Firebase and CPanel to generate accurate business insights
 */

import { getAllInspections } from './firebase';
import { fetchAllCPanelInvoices } from './cpanelService';

interface Case {
  id: string;
  customerName: string;
  customerPhone: string;
  totalPrice: number;
  status: string;
  createdAt: string;
  services?: Array<{
    serviceName?: string;
    serviceNameKa?: string;
    name?: string;
    nameKa?: string;
    price: number;
    count: number
  }>;
  caseType?: string | null;
  repair_status?: string | null;
  cpanelInvoiceId?: string;
}

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

  revenueThisMonth: number;
  revenueLastMonth: number;
  casesThisMonth: number;
  casesLastMonth: number;

  topServices: Array<{ name: string; count: number; revenue: number }>;
  topCustomers: Array<{ name: string; phone: string; totalSpent: number; casesCount: number }>;

  statusBreakdown: Array<{ status: string; count: number; percentage: number }>;
  revenueByType: Array<{ type: string; revenue: number; percentage: number }>;
}

/**
 * Normalize service name from various possible fields
 */
const getServiceName = (service: any): string => {
  return service.serviceNameKa || service.nameKa || service.serviceName || service.name || 'Unknown Service';
};

/**
 * Fetch and aggregate analytics data with accurate calculations
 */
export const getAnalyticsData = async (
  period: 'week' | 'month' | 'year' = 'month',
  dataSource: 'all' | 'firebase' | 'cpanel' = 'all'
): Promise<AnalyticsData> => {
  try {
    console.log(`[Analytics] Fetching data for period: ${period}, source: ${dataSource}`);

    let allCases: Case[] = [];

    // Fetch from Firebase
    if (dataSource === 'all' || dataSource === 'firebase') {
      try {
        const firebaseCases = await getAllInspections();
        console.log(`[Analytics] Fetched ${firebaseCases.length} cases from Firebase`);

        // Map Firebase cases to standard format
        const mappedFirebaseCases = firebaseCases.map((c: any) => ({
          id: c.id,
          customerName: c.customerName || '',
          customerPhone: c.customerPhone || '',
          totalPrice: parseFloat(c.totalPrice) || 0,
          status: c.status || 'New',
          createdAt: c.createdAt || c.serviceDate || new Date().toISOString(),
          services: c.services || [],
          caseType: c.caseType || null,
          repair_status: c.repair_status || null,
          cpanelInvoiceId: c.cpanelInvoiceId,
        }));

        allCases = [...allCases, ...mappedFirebaseCases];
      } catch (error) {
        console.error('[Analytics] Error fetching Firebase data:', error);
      }
    }

    // Fetch from CPanel
    if (dataSource === 'all' || dataSource === 'cpanel') {
      try {
        const cpanelResponse = await fetchAllCPanelInvoices({
          limit: 1000,
          onlyCPanelOnly: dataSource === 'cpanel'
        });

        if (cpanelResponse.success && cpanelResponse.invoices) {
          console.log(`[Analytics] Fetched ${cpanelResponse.invoices.length} invoices from CPanel`);

          const cpanelCases = cpanelResponse.invoices.map((invoice: any) => ({
            id: `cpanel_${invoice.cpanelId || invoice.id}`,
            customerName: invoice.customerName || '',
            customerPhone: invoice.customerPhone || '',
            totalPrice: parseFloat(invoice.totalPrice) || 0,
            status: invoice.status || 'New',
            createdAt: invoice.createdAt || invoice.serviceDate || new Date().toISOString(),
            services: invoice.services || [],
            caseType: invoice.caseType || null,
            repair_status: invoice.repair_status || null,
            cpanelInvoiceId: (invoice.cpanelId || invoice.id)?.toString(),
          }));

          allCases = [...allCases, ...cpanelCases];
        }
      } catch (error) {
        console.error('[Analytics] Error fetching CPanel data:', error);
      }
    }

    // Remove duplicates (cases synced between Firebase and CPanel)
    const uniqueCases = removeDuplicateCases(allCases);
    console.log(`[Analytics] Total unique cases after deduplication: ${uniqueCases.length}`);

    // Filter out cases with invalid data
    const validCases = uniqueCases.filter(c => {
      const hasValidPrice = !isNaN(c.totalPrice) && c.totalPrice >= 0;
      const hasValidDate = c.createdAt && !isNaN(Date.parse(c.createdAt));
      return hasValidPrice && hasValidDate;
    });

    console.log(`[Analytics] Valid cases for analysis: ${validCases.length}`);

    // Calculate date ranges
    const now = new Date();
    const startOfPeriod = getStartOfPeriod(now, period);
    const startOfPreviousPeriod = getStartOfPreviousPeriod(now, period);

    // Filter cases by period
    const casesThisPeriod = validCases.filter((c) => new Date(c.createdAt) >= startOfPeriod);
    const casesPreviousPeriod = validCases.filter(
      (c) => new Date(c.createdAt) >= startOfPreviousPeriod && new Date(c.createdAt) < startOfPeriod
    );

    // Calculate total revenue (safe parsing)
    const totalRevenue = validCases.reduce((sum, c) => sum + (parseFloat(String(c.totalPrice)) || 0), 0);
    const revenueThisPeriod = casesThisPeriod.reduce((sum, c) => sum + (parseFloat(String(c.totalPrice)) || 0), 0);
    const revenuePreviousPeriod = casesPreviousPeriod.reduce((sum, c) => sum + (parseFloat(String(c.totalPrice)) || 0), 0);

    // Calculate revenue growth
    const revenueGrowth =
      revenuePreviousPeriod > 0
        ? ((revenueThisPeriod - revenuePreviousPeriod) / revenuePreviousPeriod) * 100
        : revenueThisPeriod > 0 ? 100 : 0;

    // Count cases by status (handle Georgian statuses)
    const completedStatuses = ['Completed', 'დასრულებული'];
    const cancelledStatuses = ['Cancelled', 'გაუქმებული'];
    const preliminaryAssessmentStatuses = ['წინასწარი შეფასება'];

    const activeCases = validCases.filter(
      (c) => !completedStatuses.includes(c.status) && !cancelledStatuses.includes(c.status)
    ).length;

    const completedCases = validCases.filter((c) => completedStatuses.includes(c.status)).length;

    const preliminaryAssessmentCases = validCases.filter((c) =>
      preliminaryAssessmentStatuses.includes(c.status)
    ).length;

    // Calculate average ticket value
    const averageTicketValue = validCases.length > 0 ? totalRevenue / validCases.length : 0;

    // Calculate completion rate
    const caseCompletionRate = validCases.length > 0 ? (completedCases / validCases.length) * 100 : 0;

    // Calculate average processing time (estimate based on status)
    const averageProcessingTime = 3.5; // Placeholder - would need updatedAt dates for accuracy

    // Calculate customer metrics
    const customerMap = new Map<string, { name: string; cases: Case[] }>();
    validCases.forEach((c) => {
      if (c.customerPhone && c.customerPhone.trim()) {
        const phone = c.customerPhone.trim();
        if (!customerMap.has(phone)) {
          customerMap.set(phone, { name: c.customerName || 'უცნობი', cases: [] });
        }
        customerMap.get(phone)!.cases.push(c);
      }
    });

    const totalCustomers = customerMap.size;
    const repeatCustomers = Array.from(customerMap.values()).filter((c) => c.cases.length > 1).length;
    const repeatCustomerRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

    // Top customers by total spent
    const topCustomers = Array.from(customerMap.entries())
      .map(([phone, data]) => ({
        name: data.name,
        phone,
        totalSpent: data.cases.reduce((sum, c) => sum + (parseFloat(String(c.totalPrice)) || 0), 0),
        casesCount: data.cases.length,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10); // Top 10

    // Aggregate services with accurate revenue calculation
    const servicesMap = new Map<string, { count: number; revenue: number }>();
    validCases.forEach((c) => {
      if (c.services && Array.isArray(c.services)) {
        c.services.forEach((service: any) => {
          const name = getServiceName(service);
          const count = parseInt(String(service.count || 1)) || 1;
          const price = parseFloat(String(service.price)) || 0;
          const revenue = price * count;

          if (name && revenue > 0) {
            if (!servicesMap.has(name)) {
              servicesMap.set(name, { count: 0, revenue: 0 });
            }
            const current = servicesMap.get(name)!;
            current.count += count;
            current.revenue += revenue;
          }
        });
      }
    });

    const topServices = Array.from(servicesMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10); // Top 10

    // Status breakdown with accurate percentages
    const statusMap = new Map<string, number>();
    validCases.forEach((c) => {
      const status = c.status || 'Unknown';
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });

    const statusBreakdown = Array.from(statusMap.entries())
      .map(([status, count]) => ({
        status,
        count,
        percentage: validCases.length > 0 ? (count / validCases.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Revenue by case type with accurate calculations
    const typeRevenueMap = new Map<string, number>();
    validCases.forEach((c) => {
      const type = c.caseType || 'არ არის მითითებული';
      const revenue = parseFloat(String(c.totalPrice)) || 0;
      typeRevenueMap.set(type, (typeRevenueMap.get(type) || 0) + revenue);
    });

    const revenueByType = Array.from(typeRevenueMap.entries())
      .map(([type, revenue]) => ({
        type,
        revenue,
        percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const analyticsData: AnalyticsData = {
      totalRevenue: Math.round(totalRevenue * 100) / 100, // Round to 2 decimals
      totalCases: validCases.length,
      activeCases,
      completedCases,
      preliminaryAssessmentCases,
      averageTicketValue: Math.round(averageTicketValue * 100) / 100,
      revenueGrowth: Math.round(revenueGrowth * 10) / 10, // Round to 1 decimal
      caseCompletionRate: Math.round(caseCompletionRate * 10) / 10,
      averageProcessingTime: Math.round(averageProcessingTime * 10) / 10,
      totalCustomers,
      repeatCustomerRate: Math.round(repeatCustomerRate * 10) / 10,
      revenueThisMonth: Math.round(revenueThisPeriod * 100) / 100,
      revenueLastMonth: Math.round(revenuePreviousPeriod * 100) / 100,
      casesThisMonth: casesThisPeriod.length,
      casesLastMonth: casesPreviousPeriod.length,
      topServices: topServices.map(s => ({
        ...s,
        revenue: Math.round(s.revenue * 100) / 100,
      })),
      topCustomers: topCustomers.map(c => ({
        ...c,
        totalSpent: Math.round(c.totalSpent * 100) / 100,
      })),
      statusBreakdown: statusBreakdown.map(s => ({
        ...s,
        percentage: Math.round(s.percentage * 10) / 10,
      })),
      revenueByType: revenueByType.map(t => ({
        ...t,
        revenue: Math.round(t.revenue * 100) / 100,
        percentage: Math.round(t.percentage * 10) / 10,
      })),
    };

    console.log('[Analytics] Data aggregation complete:', {
      totalRevenue: analyticsData.totalRevenue,
      totalCases: analyticsData.totalCases,
      totalCustomers: analyticsData.totalCustomers,
    });

    return analyticsData;
  } catch (error) {
    console.error('[Analytics] Error fetching data:', error);
    throw error;
  }
};

/**
 * Remove duplicate cases (same case exists in both Firebase and CPanel)
 * Uses cpanelInvoiceId as the primary deduplication key
 */
const removeDuplicateCases = (cases: Case[]): Case[] => {
  const seen = new Set<string>();
  const seenByPhone = new Map<string, Case>();
  const unique: Case[] = [];

  // First pass: deduplicate by cpanelInvoiceId
  cases.forEach((c) => {
    if (c.cpanelInvoiceId) {
      const key = `cpanel_${c.cpanelInvoiceId}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(c);
      }
    } else {
      // For cases without cpanelInvoiceId, use phone + date + price as key
      const dateKey = c.createdAt?.substring(0, 10) || 'no-date';
      const key = `${c.customerPhone}_${c.totalPrice}_${dateKey}`;

      if (!seenByPhone.has(key)) {
        seenByPhone.set(key, c);
        unique.push(c);
      }
    }
  });

  return unique;
};

/**
 * Get the start date of a period
 */
const getStartOfPeriod = (date: Date, period: 'week' | 'month' | 'year'): Date => {
  const result = new Date(date);

  if (period === 'week') {
    result.setDate(result.getDate() - 7);
  } else if (period === 'month') {
    result.setMonth(result.getMonth() - 1);
  } else if (period === 'year') {
    result.setFullYear(result.getFullYear() - 1);
  }

  result.setHours(0, 0, 0, 0);
  return result;
};

/**
 * Get the start date of the previous period
 */
const getStartOfPreviousPeriod = (date: Date, period: 'week' | 'month' | 'year'): Date => {
  const result = new Date(date);

  if (period === 'week') {
    result.setDate(result.getDate() - 14);
  } else if (period === 'month') {
    result.setMonth(result.getMonth() - 2);
  } else if (period === 'year') {
    result.setFullYear(result.getFullYear() - 2);
  }

  result.setHours(0, 0, 0, 0);
  return result;
};

export default {
  getAnalyticsData,
};
