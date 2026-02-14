/**
 * Analytics Service — Senior Data Analyst Grade
 * 
 * Aggregates data from Firebase + CPanel with:
 * ✅ Accurate service revenue (uses discountedPrice, no double-counting)
 * ✅ Parts revenue tracking
 * ✅ Real average processing time from dates
 * ✅ Mechanic performance breakdown
 * ✅ Repair status breakdown
 * ✅ Monthly trend data (last 12 months)
 * ✅ Payment & outstanding balance data
 * ✅ Zero hardcoded/fake values
 */

import { fetchAllCPanelInvoices, fetchAllPaymentsAnalytics } from './cpanelService';
import { getAllInspections } from './firebase';

// ─── Types ─────────────────────────────────────────────

interface CaseService {
  serviceName?: string;
  serviceNameKa?: string;
  name?: string;
  nameKa?: string;
  price: number;
  count: number;
  unitRate?: number;
  discount_percent?: number;
  discountedPrice?: number;
}

interface CasePart {
  name?: string;
  partName?: string;
  unitPrice?: number;
  quantity?: number;
  totalPrice?: number;
}

interface Case {
  id: string;
  customerName: string;
  customerPhone: string;
  totalPrice: number;
  status: string;
  repair_status?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  status_changed_at?: string | null;
  services?: CaseService[];
  parts?: CasePart[];
  caseType?: string | null;
  assigned_mechanic?: string | null;
  cpanelInvoiceId?: string;
  includeVAT?: boolean;
  vatAmount?: number;
  services_discount_percent?: number;
  parts_discount_percent?: number;
  global_discount_percent?: number;
}

export interface MonthlyDataPoint {
  month: string;       // "2025-01"
  label: string;       // "იან"
  revenue: number;
  cases: number;
  collected: number;
}

export interface MechanicStats {
  name: string;
  casesCount: number;
  revenue: number;
  completedCount: number;
  activeCases: number;
}

export interface PaymentSummary {
  totalCollected: number;
  totalInvoiced: number;
  totalOutstanding: number;
  collectionRate: number;
  methodBreakdown: Array<{ method: string; amount: number; percentage: number }>;
}

export interface AnalyticsData {
  // Core metrics
  totalRevenue: number;
  serviceRevenue: number;
  partsRevenue: number;
  totalCases: number;
  activeCases: number;
  completedCases: number;
  preliminaryAssessmentCases: number;
  cancelledCases: number;
  averageTicketValue: number;
  averageTicketGrowth: number;
  revenueGrowth: number;
  caseCompletionRate: number;
  averageProcessingDays: number;
  totalCustomers: number;
  repeatCustomerRate: number;
  newCustomersThisPeriod: number;

  // Period comparison
  revenueThisPeriod: number;
  revenuePreviousPeriod: number;
  casesThisPeriod: number;
  casesPreviousPeriod: number;

  // Breakdowns
  topServices: Array<{ name: string; count: number; revenue: number }>;
  topCustomers: Array<{ name: string; phone: string; totalSpent: number; casesCount: number }>;
  statusBreakdown: Array<{ status: string; count: number; percentage: number }>;
  repairStatusBreakdown: Array<{ status: string; count: number; percentage: number }>;
  revenueByType: Array<{ type: string; revenue: number; count: number; percentage: number }>;
  mechanicStats: MechanicStats[];

  // Trends
  monthlyTrend: MonthlyDataPoint[];

  // Payments
  payments: PaymentSummary;

  // Discount analytics
  totalDiscountGiven: number;
  vatCollected: number;
}

// ─── Helpers ───────────────────────────────────────────

const getServiceName = (service: any): string => {
  return service.serviceNameKa || service.nameKa || service.serviceName || service.name || 'უცნობი სერვისი';
};

/**
 * Accurate service line revenue.
 * cPanel stores: price (can be unit or total), unitRate, discountedPrice
 * Prefer discountedPrice > unitRate*count > price (used as-is to avoid double-count risk)
 */
const getServiceRevenue = (service: CaseService): number => {
  if (service.discountedPrice && service.discountedPrice > 0) {
    return service.discountedPrice;
  }
  if (service.unitRate && service.unitRate > 0) {
    const count = Math.max(1, service.count || 1);
    return service.unitRate * count;
  }
  // price field — use directly (avoids double-count if it's already a total)
  return parseFloat(String(service.price)) || 0;
};

const getPartRevenue = (part: CasePart): number => {
  if (part.totalPrice && part.totalPrice > 0) return part.totalPrice;
  const qty = Math.max(1, part.quantity || 1);
  const unit = parseFloat(String(part.unitPrice)) || 0;
  return unit * qty;
};

const daysBetween = (dateA: string, dateB: string): number => {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.abs(b - a) / (1000 * 60 * 60 * 24);
};

const COMPLETED_STATUSES = ['Completed', 'დასრულებული'];
const CANCELLED_STATUSES = ['Cancelled', 'გაუქმებული'];
const PRELIMINARY_STATUSES = ['წინასწარი შეფასება'];

const isCompleted = (status: string) => COMPLETED_STATUSES.includes(status);
const isCancelled = (status: string) => CANCELLED_STATUSES.includes(status);

// ─── Date helpers ──────────────────────────────────────

const getStartOfPeriod = (date: Date, period: 'week' | 'month' | 'year'): Date => {
  const d = new Date(date);
  if (period === 'week') d.setDate(d.getDate() - 7);
  else if (period === 'month') d.setMonth(d.getMonth() - 1);
  else d.setFullYear(d.getFullYear() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getStartOfPreviousPeriod = (date: Date, period: 'week' | 'month' | 'year'): Date => {
  const d = new Date(date);
  if (period === 'week') d.setDate(d.getDate() - 14);
  else if (period === 'month') d.setMonth(d.getMonth() - 2);
  else d.setFullYear(d.getFullYear() - 2);
  d.setHours(0, 0, 0, 0);
  return d;
};

// ─── Deduplication ─────────────────────────────────────

const removeDuplicateCases = (cases: Case[]): Case[] => {
  const seenCpanel = new Set<string>();
  const seenComposite = new Set<string>();
  const unique: Case[] = [];

  cases.forEach((c) => {
    if (c.cpanelInvoiceId) {
      const key = `cpanel_${c.cpanelInvoiceId}`;
      if (!seenCpanel.has(key)) {
        seenCpanel.add(key);
        unique.push(c);
      }
    } else {
      const dateKey = c.createdAt?.substring(0, 10) || 'no-date';
      const key = `${c.customerPhone}_${c.totalPrice}_${dateKey}`;
      if (!seenComposite.has(key)) {
        seenComposite.add(key);
        unique.push(c);
      }
    }
  });

  return unique;
};

// ─── Main export ───────────────────────────────────────

export const getAnalyticsData = async (
  period: 'week' | 'month' | 'year' = 'month',
  dataSource: 'all' | 'firebase' | 'cpanel' = 'all'
): Promise<AnalyticsData> => {
  try {
    console.log(`[Analytics] Fetching data | period=${period} source=${dataSource}`);

    let allCases: Case[] = [];

    // ── Fetch Firebase ──
    if (dataSource === 'all' || dataSource === 'firebase') {
      try {
        const firebaseCases = await getAllInspections();
        console.log(`[Analytics] Firebase: ${firebaseCases.length} cases`);

        const mapped = firebaseCases.map((c: any) => ({
          id: c.id,
          customerName: c.customerName || '',
          customerPhone: c.customerPhone || '',
          totalPrice: parseFloat(c.totalPrice) || 0,
          status: c.status || 'New',
          repair_status: c.repair_status || null,
          createdAt: c.createdAt || c.serviceDate || new Date().toISOString(),
          updatedAt: c.updatedAt || null,
          status_changed_at: c.status_changed_at || null,
          services: c.services || [],
          parts: c.parts || [],
          caseType: c.caseType || null,
          assigned_mechanic: c.assigned_mechanic || null,
          cpanelInvoiceId: c.cpanelInvoiceId,
          includeVAT: c.includeVAT || false,
          vatAmount: parseFloat(c.vatAmount) || 0,
        }));

        allCases.push(...mapped);
      } catch (err) {
        console.error('[Analytics] Firebase error:', err);
      }
    }

    // ── Fetch CPanel ──
    if (dataSource === 'all' || dataSource === 'cpanel') {
      try {
        const resp = await fetchAllCPanelInvoices({ limit: 2000, onlyCPanelOnly: dataSource === 'cpanel' });
        if (resp.success && resp.invoices) {
          console.log(`[Analytics] CPanel: ${resp.invoices.length} invoices`);

          const mapped = resp.invoices.map((inv: any) => ({
            id: `cpanel_${inv.cpanelId || inv.id}`,
            customerName: inv.customerName || '',
            customerPhone: inv.customerPhone || '',
            totalPrice: parseFloat(inv.totalPrice) || 0,
            status: inv.status || 'New',
            repair_status: inv.repair_status || null,
            createdAt: inv.createdAt || inv.serviceDate || new Date().toISOString(),
            updatedAt: inv.updatedAt || null,
            status_changed_at: inv.status_changed_at || null,
            services: inv.services || [],
            parts: inv.parts || [],
            caseType: inv.caseType || null,
            assigned_mechanic: inv.assigned_mechanic || null,
            cpanelInvoiceId: (inv.cpanelId || inv.id)?.toString(),
            includeVAT: inv.includeVAT || false,
            vatAmount: parseFloat(inv.vatAmount) || 0,
            services_discount_percent: parseFloat(inv.services_discount_percent) || 0,
            parts_discount_percent: parseFloat(inv.parts_discount_percent) || 0,
            global_discount_percent: parseFloat(inv.global_discount_percent) || 0,
          }));

          allCases.push(...mapped);
        }
      } catch (err) {
        console.error('[Analytics] CPanel error:', err);
      }
    }

    // ── Fetch payment analytics ──
    let paymentData: PaymentSummary = {
      totalCollected: 0,
      totalInvoiced: 0,
      totalOutstanding: 0,
      collectionRate: 0,
      methodBreakdown: [],
    };

    let paymentMonthlyData: any[] = [];

    if (dataSource === 'all' || dataSource === 'cpanel') {
      try {
        const payResp: any = await fetchAllPaymentsAnalytics();
        if (payResp?.success && payResp?.data) {
          paymentData = {
            totalCollected: payResp.data.totalCollected || 0,
            totalInvoiced: payResp.data.totalInvoiced || 0,
            totalOutstanding: payResp.data.totalOutstanding || 0,
            collectionRate: payResp.data.collectionRate || 0,
            methodBreakdown: payResp.data.methodBreakdown || [],
          };
          paymentMonthlyData = payResp.data.monthlyData || [];
        }
      } catch (err) {
        console.error('[Analytics] Payment analytics error:', err);
      }
    }

    // ── Deduplicate & validate ──
    const uniqueCases = removeDuplicateCases(allCases);
    const validCases = uniqueCases.filter((c) => {
      return !isNaN(c.totalPrice) && c.totalPrice >= 0 && c.createdAt && !isNaN(Date.parse(c.createdAt));
    });

    console.log(`[Analytics] Unique=${uniqueCases.length}, Valid=${validCases.length}`);

    // ── Period ranges ──
    const now = new Date();
    const startOfPeriod = getStartOfPeriod(now, period);
    const startOfPrevious = getStartOfPreviousPeriod(now, period);

    const casesThisPeriod = validCases.filter((c) => new Date(c.createdAt) >= startOfPeriod);
    const casesPreviousPeriod = validCases.filter(
      (c) => new Date(c.createdAt) >= startOfPrevious && new Date(c.createdAt) < startOfPeriod
    );

    // ── Revenue ──
    const totalRevenue = validCases.reduce((s, c) => s + c.totalPrice, 0);
    const revenueThis = casesThisPeriod.reduce((s, c) => s + c.totalPrice, 0);
    const revenuePrev = casesPreviousPeriod.reduce((s, c) => s + c.totalPrice, 0);
    const revenueGrowth = revenuePrev > 0 ? ((revenueThis - revenuePrev) / revenuePrev) * 100 : revenueThis > 0 ? 100 : 0;

    // Average ticket growth (compare period avg ticket vs previous period avg ticket)
    const avgTicketThis = casesThisPeriod.length > 0 ? revenueThis / casesThisPeriod.length : 0;
    const avgTicketPrev = casesPreviousPeriod.length > 0 ? revenuePrev / casesPreviousPeriod.length : 0;
    const averageTicketGrowth = avgTicketPrev > 0 ? ((avgTicketThis - avgTicketPrev) / avgTicketPrev) * 100 : 0;

    // ── Service & Parts revenue (accurate) ──
    let serviceRevenue = 0;
    let partsRevenue = 0;
    let totalDiscountGiven = 0;
    let vatCollected = 0;

    const servicesMap = new Map<string, { count: number; revenue: number }>();

    validCases.forEach((c) => {
      // Service revenue
      if (c.services && Array.isArray(c.services)) {
        c.services.forEach((svc) => {
          const rev = getServiceRevenue(svc);
          serviceRevenue += rev;

          const name = getServiceName(svc);
          const count = Math.max(1, parseInt(String(svc.count || 1)) || 1);

          if (name && rev > 0) {
            const existing = servicesMap.get(name) || { count: 0, revenue: 0 };
            existing.count += count;
            existing.revenue += rev;
            servicesMap.set(name, existing);
          }
        });
      }

      // Parts revenue
      if (c.parts && Array.isArray(c.parts)) {
        c.parts.forEach((part) => {
          partsRevenue += getPartRevenue(part);
        });
      }

      // Discounts
      if (c.global_discount_percent && c.global_discount_percent > 0) {
        totalDiscountGiven += (c.totalPrice * c.global_discount_percent) / (100 - c.global_discount_percent);
      }

      // VAT
      if (c.includeVAT && c.vatAmount) {
        vatCollected += c.vatAmount;
      }
    });

    const topServices = Array.from(servicesMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((s) => ({ ...s, revenue: Math.round(s.revenue * 100) / 100 }));

    // ── Status counts ──
    const completedCases = validCases.filter((c) => isCompleted(c.status)).length;
    const cancelledCases = validCases.filter((c) => isCancelled(c.status)).length;
    const activeCases = validCases.length - completedCases - cancelledCases;
    const preliminaryAssessmentCases = validCases.filter((c) => PRELIMINARY_STATUSES.includes(c.status)).length;
    const caseCompletionRate = validCases.length > 0 ? (completedCases / validCases.length) * 100 : 0;

    // ── Real average processing time ──
    const completedWithDates = validCases.filter(
      (c) => isCompleted(c.status) && c.createdAt && (c.updatedAt || c.status_changed_at)
    );
    let averageProcessingDays = 0;
    if (completedWithDates.length > 0) {
      const totalDays = completedWithDates.reduce((sum, c) => {
        const endDate = c.status_changed_at || c.updatedAt || c.createdAt;
        return sum + daysBetween(c.createdAt, endDate);
      }, 0);
      averageProcessingDays = totalDays / completedWithDates.length;
    }

    // ── Customer metrics ──
    const customerMap = new Map<string, { name: string; cases: Case[] }>();
    validCases.forEach((c) => {
      const phone = c.customerPhone?.trim();
      if (phone) {
        if (!customerMap.has(phone)) customerMap.set(phone, { name: c.customerName || 'უცნობი', cases: [] });
        customerMap.get(phone)!.cases.push(c);
      }
    });

    const totalCustomers = customerMap.size;
    const repeatCustomers = Array.from(customerMap.values()).filter((d) => d.cases.length > 1).length;
    const repeatCustomerRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

    // New customers this period
    const newCustomersThisPeriod = new Set(
      casesThisPeriod
        .filter((c) => c.customerPhone?.trim())
        .filter((c) => {
          const allCasesForCustomer = customerMap.get(c.customerPhone.trim());
          if (!allCasesForCustomer) return false;
          const earliest = allCasesForCustomer.cases.reduce((min, cc) =>
            new Date(cc.createdAt) < new Date(min.createdAt) ? cc : min
          );
          return new Date(earliest.createdAt) >= startOfPeriod;
        })
        .map((c) => c.customerPhone.trim())
    ).size;

    const topCustomers = Array.from(customerMap.entries())
      .map(([phone, data]) => ({
        name: data.name,
        phone,
        totalSpent: Math.round(data.cases.reduce((s, c) => s + c.totalPrice, 0) * 100) / 100,
        casesCount: data.cases.length,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    // ── Status breakdown ──
    const statusMap = new Map<string, number>();
    validCases.forEach((c) => statusMap.set(c.status, (statusMap.get(c.status) || 0) + 1));
    const statusBreakdown = Array.from(statusMap.entries())
      .map(([status, count]) => ({
        status,
        count,
        percentage: validCases.length > 0 ? Math.round((count / validCases.length) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // ── Repair status breakdown ──
    const repairMap = new Map<string, number>();
    validCases.forEach((c) => {
      const rs = c.repair_status || 'არ არის მინიჭებული';
      repairMap.set(rs, (repairMap.get(rs) || 0) + 1);
    });
    const repairStatusBreakdown = Array.from(repairMap.entries())
      .map(([status, count]) => ({
        status,
        count,
        percentage: validCases.length > 0 ? Math.round((count / validCases.length) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // ── Revenue by case type ──
    const typeMap = new Map<string, { revenue: number; count: number }>();
    validCases.forEach((c) => {
      const type = c.caseType || 'არ არის მითითებული';
      const existing = typeMap.get(type) || { revenue: 0, count: 0 };
      existing.revenue += c.totalPrice;
      existing.count += 1;
      typeMap.set(type, existing);
    });
    const revenueByType = Array.from(typeMap.entries())
      .map(([type, data]) => ({
        type,
        revenue: Math.round(data.revenue * 100) / 100,
        count: data.count,
        percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // ── Mechanic stats ──
    const mechMap = new Map<string, { cases: Case[] }>();
    validCases.forEach((c) => {
      const mech = c.assigned_mechanic || 'არ არის მინიჭებული';
      if (!mechMap.has(mech)) mechMap.set(mech, { cases: [] });
      mechMap.get(mech)!.cases.push(c);
    });
    const mechanicStats: MechanicStats[] = Array.from(mechMap.entries())
      .map(([name, data]) => ({
        name,
        casesCount: data.cases.length,
        revenue: Math.round(data.cases.reduce((s, c) => s + c.totalPrice, 0) * 100) / 100,
        completedCount: data.cases.filter((c) => isCompleted(c.status)).length,
        activeCases: data.cases.filter((c) => !isCompleted(c.status) && !isCancelled(c.status)).length,
      }))
      .filter((m) => m.name !== 'არ არის მინიჭებული')
      .sort((a, b) => b.revenue - a.revenue);

    // ── Monthly trend (last 12 months) ──
    const monthlyTrend: MonthlyDataPoint[] = [];
    const monthNames = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const monthCases = validCases.filter((c) => c.createdAt.substring(0, 7) === monthKey);
      const monthRevenue = monthCases.reduce((s, c) => s + c.totalPrice, 0);

      // Try to get collected amount from payment monthly data
      const payMonth = paymentMonthlyData.find((pm: any) => pm.month === monthKey);

      monthlyTrend.push({
        month: monthKey,
        label: monthNames[d.getMonth()],
        revenue: Math.round(monthRevenue * 100) / 100,
        cases: monthCases.length,
        collected: payMonth ? Math.round((payMonth.collected || 0) * 100) / 100 : 0,
      });
    }

    // ── Assemble result ──
    const averageTicketValue = validCases.length > 0 ? totalRevenue / validCases.length : 0;

    const result: AnalyticsData = {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      serviceRevenue: Math.round(serviceRevenue * 100) / 100,
      partsRevenue: Math.round(partsRevenue * 100) / 100,
      totalCases: validCases.length,
      activeCases,
      completedCases,
      preliminaryAssessmentCases,
      cancelledCases,
      averageTicketValue: Math.round(averageTicketValue * 100) / 100,
      averageTicketGrowth: Math.round(averageTicketGrowth * 10) / 10,
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
      caseCompletionRate: Math.round(caseCompletionRate * 10) / 10,
      averageProcessingDays: Math.round(averageProcessingDays * 10) / 10,
      totalCustomers,
      repeatCustomerRate: Math.round(repeatCustomerRate * 10) / 10,
      newCustomersThisPeriod,
      revenueThisPeriod: Math.round(revenueThis * 100) / 100,
      revenuePreviousPeriod: Math.round(revenuePrev * 100) / 100,
      casesThisPeriod: casesThisPeriod.length,
      casesPreviousPeriod: casesPreviousPeriod.length,
      topServices,
      topCustomers,
      statusBreakdown,
      repairStatusBreakdown,
      revenueByType,
      mechanicStats,
      monthlyTrend,
      payments: paymentData,
      totalDiscountGiven: Math.round(totalDiscountGiven * 100) / 100,
      vatCollected: Math.round(vatCollected * 100) / 100,
    };

    console.log('[Analytics] Complete:', {
      totalRevenue: result.totalRevenue,
      cases: result.totalCases,
      customers: result.totalCustomers,
      mechanics: result.mechanicStats.length,
      serviceRev: result.serviceRevenue,
      partsRev: result.partsRevenue,
    });

    return result;
  } catch (error) {
    console.error('[Analytics] Fatal error:', error);
    throw error;
  }
};

export default { getAnalyticsData };
