/**
 * Case Search Service
 * Comprehensive search across all case fields (plate, customer, car, phone, status, etc.)
 */

import { fetchAllCPanelInvoices } from './cpanelService';
import { getAllInspections } from './firebase';

export interface SearchResult {
  id: string;
  plate: string;
  customerName: string;
  customerPhone: string;
  carMake?: string;
  carModel?: string;
  status: string;
  repair_status?: string | null;
  totalPrice: number;
  createdAt: string;
  source: 'firebase' | 'cpanel';
  cpanelInvoiceId?: string;
  matchedFields: string[]; // Which fields matched the search
  relevanceScore: number; // How relevant is this result (0-100)
}

/**
 * Normalize text for searching (lowercase, remove extra spaces)
 */
const normalizeText = (text: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // Normalize multiple spaces to single space
};

/**
 * Check if a field contains the search term
 */
const fieldContains = (fieldValue: any, searchTerm: string): boolean => {
  if (!fieldValue) return false;
  const normalized = normalizeText(String(fieldValue));
  return normalized.includes(searchTerm);
};

/**
 * Calculate relevance score based on match type
 */
const calculateRelevance = (
  searchTerm: string,
  matchedFields: string[],
  exactMatches: string[]
): number => {
  let score = 0;
  
  // Exact matches get highest score
  if (exactMatches.includes('plate')) score += 50;
  if (exactMatches.includes('customerPhone')) score += 40;
  if (exactMatches.includes('customerName')) score += 30;
  
  // Partial matches get lower score
  if (matchedFields.includes('plate') && !exactMatches.includes('plate')) score += 30;
  if (matchedFields.includes('customerName') && !exactMatches.includes('customerName')) score += 20;
  if (matchedFields.includes('customerPhone') && !exactMatches.includes('customerPhone')) score += 25;
  if (matchedFields.includes('carMake')) score += 15;
  if (matchedFields.includes('carModel')) score += 15;
  if (matchedFields.includes('status')) score += 10;
  if (matchedFields.includes('repair_status')) score += 10;
  
  return Math.min(score, 100);
};

/**
 * Search cases across all fields
 */
export const searchCases = async (
  searchQuery: string,
  options: { 
    limit?: number;
    minRelevance?: number;
    includeFirebase?: boolean;
    includeCPanel?: boolean;
  } = {}
): Promise<SearchResult[]> => {
  const { 
    limit = 20, 
    minRelevance = 10,
    includeFirebase = true,
    includeCPanel = true
  } = options;
  
  const normalizedQuery = normalizeText(searchQuery);
  
  if (!normalizedQuery || normalizedQuery.length < 2) {
    console.log('[CaseSearch] Search query too short:', searchQuery);
    return [];
  }
  
  console.log('[CaseSearch] Searching for:', normalizedQuery);
  
  const results: SearchResult[] = [];
  
  try {
    // Search Firebase cases
    if (includeFirebase) {
      console.log('[CaseSearch] Searching Firebase...');
      const firebaseCases = await getAllInspections();
      
      for (const caseItem of firebaseCases) {
        const matchedFields: string[] = [];
        const exactMatches: string[] = [];
        
        // Check plate
        if (caseItem.plate && fieldContains(caseItem.plate, normalizedQuery)) {
          matchedFields.push('plate');
          if (normalizeText(caseItem.plate) === normalizedQuery) {
            exactMatches.push('plate');
          }
        }
        
        // Check customer name
        if (caseItem.customerName && fieldContains(caseItem.customerName, normalizedQuery)) {
          matchedFields.push('customerName');
          if (normalizeText(caseItem.customerName) === normalizedQuery) {
            exactMatches.push('customerName');
          }
        }
        
        // Check customer phone
        if (caseItem.customerPhone && fieldContains(caseItem.customerPhone, normalizedQuery)) {
          matchedFields.push('customerPhone');
          if (normalizeText(caseItem.customerPhone) === normalizedQuery) {
            exactMatches.push('customerPhone');
          }
        }
        
        // Check car make
        if (caseItem.carMake && fieldContains(caseItem.carMake, normalizedQuery)) {
          matchedFields.push('carMake');
        }
        
        // Check car model
        if (caseItem.carModel && fieldContains(caseItem.carModel, normalizedQuery)) {
          matchedFields.push('carModel');
        }
        
        // Check status
        if (caseItem.status && fieldContains(caseItem.status, normalizedQuery)) {
          matchedFields.push('status');
        }
        
        // Check repair status
        if (caseItem.repair_status && fieldContains(caseItem.repair_status, normalizedQuery)) {
          matchedFields.push('repair_status');
        }
        
        // Check case ID (partial match)
        if (caseItem.id && fieldContains(caseItem.id, normalizedQuery)) {
          matchedFields.push('id');
        }
        
        // If any field matched, add to results
        if (matchedFields.length > 0) {
          const relevanceScore = calculateRelevance(normalizedQuery, matchedFields, exactMatches);
          
          if (relevanceScore >= minRelevance) {
            results.push({
              id: caseItem.id,
              plate: caseItem.plate || 'N/A',
              customerName: caseItem.customerName || 'N/A',
              customerPhone: caseItem.customerPhone || 'N/A',
              carMake: caseItem.carMake,
              carModel: caseItem.carModel,
              status: caseItem.status || 'New',
              repair_status: caseItem.repair_status,
              totalPrice: caseItem.totalPrice || 0,
              createdAt: caseItem.createdAt,
              source: 'firebase',
              cpanelInvoiceId: caseItem.cpanelInvoiceId,
              matchedFields,
              relevanceScore,
            });
          }
        }
      }
      
      console.log('[CaseSearch] Firebase matches:', results.length);
    }
    
    // Search CPanel cases
    if (includeCPanel) {
      console.log('[CaseSearch] Searching CPanel...');
      const cpanelResponse: any = await fetchAllCPanelInvoices({ 
        limit: 500, 
        onlyCPanelOnly: false
      });
      
      if (cpanelResponse?.success) {
        const invoices = cpanelResponse.invoices || cpanelResponse.data?.invoices || cpanelResponse.data || [];
        console.log('[CaseSearch] CPanel invoices to search:', Array.isArray(invoices) ? invoices.length : 0);
        
        for (const invoice of (Array.isArray(invoices) ? invoices : [])) {
          const matchedFields: string[] = [];
          const exactMatches: string[] = [];
          
          // Try multiple plate field names
          const invoicePlate = invoice.plate || invoice.vehicle_plate || invoice.vehiclePlate || '';
          
          // Check plate
          if (invoicePlate && fieldContains(invoicePlate, normalizedQuery)) {
            matchedFields.push('plate');
            if (normalizeText(invoicePlate) === normalizedQuery) {
              exactMatches.push('plate');
            }
          }
          
          // Check customer name
          const customerName = invoice.customerName || invoice.customer_name || '';
          if (customerName && fieldContains(customerName, normalizedQuery)) {
            matchedFields.push('customerName');
            if (normalizeText(customerName) === normalizedQuery) {
              exactMatches.push('customerName');
            }
          }
          
          // Check customer phone
          const customerPhone = invoice.customerPhone || invoice.customer_phone || invoice.phone || '';
          if (customerPhone && fieldContains(customerPhone, normalizedQuery)) {
            matchedFields.push('customerPhone');
            if (normalizeText(customerPhone) === normalizedQuery) {
              exactMatches.push('customerPhone');
            }
          }
          
          // Check car make
          const carMake = invoice.carMake || invoice.vehicleMake || invoice.vehicle_make || '';
          if (carMake && fieldContains(carMake, normalizedQuery)) {
            matchedFields.push('carMake');
          }
          
          // Check car model
          const carModel = invoice.carModel || invoice.vehicleModel || invoice.vehicle_model || '';
          if (carModel && fieldContains(carModel, normalizedQuery)) {
            matchedFields.push('carModel');
          }
          
          // Check status
          if (invoice.status && fieldContains(invoice.status, normalizedQuery)) {
            matchedFields.push('status');
          }
          
          // Check repair status
          if (invoice.repair_status && fieldContains(invoice.repair_status, normalizedQuery)) {
            matchedFields.push('repair_status');
          }
          
          // Check invoice ID (partial match)
          const invoiceId = invoice.cpanelId || invoice.id || invoice.transfer_id || invoice.invoiceId || invoice.invoice_id;
          if (invoiceId && fieldContains(String(invoiceId), normalizedQuery)) {
            matchedFields.push('id');
          }
          
          // If any field matched, add to results
          if (matchedFields.length > 0) {
            const relevanceScore = calculateRelevance(normalizedQuery, matchedFields, exactMatches);
            
            if (relevanceScore >= minRelevance) {
              // Check if we already have this from Firebase (by cpanelInvoiceId)
              const alreadyExists = results.some(
                r => r.cpanelInvoiceId === String(invoiceId)
              );
              
              if (!alreadyExists && invoiceId) {
                results.push({
                  id: String(invoiceId),
                  plate: invoicePlate || 'N/A',
                  customerName: customerName || 'N/A',
                  customerPhone: customerPhone || 'N/A',
                  carMake: carMake || undefined,
                  carModel: carModel || undefined,
                  status: invoice.status || 'New',
                  repair_status: invoice.repair_status || null,
                  totalPrice: invoice.totalPrice || invoice.total_price || 0,
                  createdAt: invoice.createdAt || invoice.created_at || invoice.service_date,
                  source: invoice.firebaseId ? 'firebase' : 'cpanel',
                  cpanelInvoiceId: String(invoiceId),
                  matchedFields,
                  relevanceScore,
                });
              }
            }
          }
        }
      }
      
      console.log('[CaseSearch] Total matches after CPanel:', results.length);
    }
    
    // Sort by relevance score (highest first), then by date (newest first)
    results.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    // Return limited results
    return results.slice(0, limit);
    
  } catch (error) {
    console.error('[CaseSearch] Error searching cases:', error);
    throw error;
  }
};

/**
 * Get a user-friendly label for matched fields
 */
export const getMatchedFieldsLabel = (matchedFields: string[]): string => {
  const labels: Record<string, string> = {
    plate: 'ნომერი',
    customerName: 'სახელი',
    customerPhone: 'ტელეფონი',
    carMake: 'მარკა',
    carModel: 'მოდელი',
    status: 'სტატუსი',
    repair_status: 'რემონტის სტატუსი',
    id: 'ID',
  };
  
  const georgianLabels = matchedFields
    .map(field => labels[field] || field)
    .filter(Boolean);
  
  return georgianLabels.join(', ');
};
