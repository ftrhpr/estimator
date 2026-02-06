/**
 * Plate Search Service
 * Searches for cases across Firebase and CPanel by license plate number
 */

import { fetchAllCPanelInvoices } from './cpanelService';
import { getAllInspections } from './firebase';

export interface SearchResult {
  id: string;
  plate: string;
  customerName: string;
  carMake?: string;
  carModel?: string;
  status: string;
  totalPrice: number;
  createdAt: string;
  source: 'firebase' | 'cpanel';
  cpanelInvoiceId?: string;
}

/**
 * Normalize a plate number for comparison
 * Removes spaces, dashes, and converts to uppercase
 * Handles Georgian plate format: XX-123-XX or XX123XX
 */
export const normalizePlate = (plate: string): string => {
  if (!plate) return '';
  return plate
    .toUpperCase()
    .replace(/[\s\-\.]/g, '') // Remove spaces, dashes, dots
    .replace(/[^A-Z0-9]/g, '') // Keep only alphanumeric
    .trim();
};

/**
 * Check if two plates match (with normalization)
 */
export const platesMatch = (plate1: string, plate2: string): boolean => {
  const normalized1 = normalizePlate(plate1);
  const normalized2 = normalizePlate(plate2);
  
  if (!normalized1 || !normalized2) return false;
  
  // Exact match
  if (normalized1 === normalized2) return true;
  
  // One contains the other (for partial matches)
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    // Only if the shorter one is at least 4 characters
    const shorter = normalized1.length < normalized2.length ? normalized1 : normalized2;
    return shorter.length >= 4;
  }
  
  return false;
};

/**
 * Calculate similarity score between two plates (0-100)
 */
export const plateSimilarity = (plate1: string, plate2: string): number => {
  const normalized1 = normalizePlate(plate1);
  const normalized2 = normalizePlate(plate2);
  
  if (!normalized1 || !normalized2) return 0;
  if (normalized1 === normalized2) return 100;
  
  // Calculate Levenshtein distance
  const len1 = normalized1.length;
  const len2 = normalized2.length;
  const matrix: number[][] = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = normalized1[i - 1] === normalized2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return Math.round((1 - distance / maxLen) * 100);
};

/**
 * Search for cases by plate number across all sources
 */
export const searchCasesByPlate = async (
  searchPlate: string,
  options: { minSimilarity?: number; limit?: number } = {}
): Promise<SearchResult[]> => {
  const { minSimilarity = 70, limit = 10 } = options;
  const normalizedSearch = normalizePlate(searchPlate);
  
  if (!normalizedSearch || normalizedSearch.length < 3) {
    console.log('[PlateSearch] Search plate too short:', searchPlate);
    return [];
  }
  
  console.log('[PlateSearch] Searching for plate:', normalizedSearch);
  
  const results: (SearchResult & { similarity: number })[] = [];
  
  try {
    // Search Firebase cases
    console.log('[PlateSearch] Searching Firebase...');
    const firebaseCases = await getAllInspections();
    
    for (const caseItem of firebaseCases) {
      if (caseItem.plate) {
        const similarity = plateSimilarity(searchPlate, caseItem.plate);
        if (similarity >= minSimilarity) {
          results.push({
            id: caseItem.id,
            plate: caseItem.plate,
            customerName: caseItem.customerName || 'N/A',
            carMake: caseItem.carMake,
            carModel: caseItem.carModel,
            status: caseItem.status || 'New',
            totalPrice: caseItem.totalPrice || 0,
            createdAt: caseItem.createdAt,
            source: 'firebase',
            cpanelInvoiceId: caseItem.cpanelInvoiceId,
            similarity,
          });
        }
      }
    }
    
    console.log('[PlateSearch] Firebase matches:', results.length);
    
    // Search ALL CPanel cases (not just cpanel-only)
    console.log('[PlateSearch] Searching CPanel...');
    const cpanelResponse: any = await fetchAllCPanelInvoices({ 
      limit: 500, 
      onlyCPanelOnly: false  // Search ALL invoices, not just CPanel-only
    });
    
    if (cpanelResponse?.success) {
      // Handle different response structures: cpanelResponse.invoices or cpanelResponse.data.invoices
      const invoices = cpanelResponse.invoices || cpanelResponse.data?.invoices || cpanelResponse.data || [];
      console.log('[PlateSearch] CPanel invoices to search:', Array.isArray(invoices) ? invoices.length : 0);
      
      // Log first few plates for debugging
      const samplePlates = (Array.isArray(invoices) ? invoices : [])
        .slice(0, 5)
        .map((inv: any) => inv.plate || inv.vehicle_plate || 'no-plate');
      console.log('[PlateSearch] Sample plates from CPanel:', samplePlates);
      
      for (const invoice of (Array.isArray(invoices) ? invoices : [])) {
        // Try multiple plate field names
        const invoicePlate = invoice.plate || invoice.vehicle_plate || invoice.vehiclePlate || '';
        
        if (invoicePlate) {
          const similarity = plateSimilarity(searchPlate, invoicePlate);
          
          // Log high similarity matches for debugging
          if (similarity >= 50) {
            console.log(`[PlateSearch] Potential match: ${invoicePlate} (${similarity}% similar)`);
            console.log(`[PlateSearch] Invoice ID fields: cpanelId=${invoice.cpanelId}, id=${invoice.id}, transfer_id=${invoice.transfer_id}`);
          }
          
          if (similarity >= minSimilarity) {
            // Get the invoice ID - cpanelId is the primary field from the API
            const invoiceId = invoice.cpanelId || invoice.id || invoice.transfer_id || invoice.invoiceId || invoice.invoice_id;
            
            // Check if we already have this from Firebase (by cpanelInvoiceId)
            const alreadyExists = results.some(
              r => r.cpanelInvoiceId === String(invoiceId)
            );
            
            if (!alreadyExists && invoiceId) {
              results.push({
                id: String(invoiceId),
                plate: invoicePlate,
                customerName: invoice.customerName || invoice.customer_name || 'N/A',
                carMake: invoice.carMake || invoice.vehicleMake || invoice.vehicle_make,
                carModel: invoice.carModel || invoice.vehicleModel || invoice.vehicle_model,
                status: invoice.status || 'New',
                totalPrice: invoice.totalPrice || invoice.total_price || 0,
                createdAt: invoice.createdAt || invoice.created_at || invoice.service_date,
                source: invoice.firebaseId ? 'firebase' : 'cpanel',
                cpanelInvoiceId: String(invoiceId),
                similarity,
              });
              console.log(`[PlateSearch] Added result with ID: ${invoiceId}, plate: ${invoicePlate}`);
            } else if (!invoiceId) {
              console.warn(`[PlateSearch] Invoice has no ID field, skipping:`, JSON.stringify(invoice));
            }
          }
        }
      }
    }
    
    console.log('[PlateSearch] Total matches:', results.length);
    
    // Sort by similarity (highest first), then by date (newest first)
    results.sort((a, b) => {
      if (b.similarity !== a.similarity) {
        return b.similarity - a.similarity;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    // Return limited results
    return results.slice(0, limit);
    
  } catch (error) {
    console.error('[PlateSearch] Error searching cases:', error);
    throw error;
  }
};

/**
 * Find exact match for a plate
 * Returns the first case with an exact plate match
 */
export const findExactPlateMatch = async (
  searchPlate: string
): Promise<SearchResult | null> => {
  const results = await searchCasesByPlate(searchPlate, { minSimilarity: 100, limit: 1 });
  return results.length > 0 ? results[0] : null;
};

/**
 * Clean OCR text to extract plate number
 * Georgian plates follow format: XX-123-XX (2 letters, 3 digits, 2 letters)
 */
export const extractPlateFromOCR = (ocrText: string): string | null => {
  if (!ocrText) return null;
  
  // Remove common noise from OCR
  const cleaned = ocrText
    .toUpperCase()
    .replace(/[^A-Z0-9\s\-]/g, '') // Keep letters, numbers, spaces, dashes
    .trim();
  
  // Georgian plate patterns:
  // Standard: XX-123-XX or XX123XX
  // Old format: XXX-123 or similar
  
  // Try to match standard Georgian plate format
  const georgianPlateRegex = /([A-Z]{2})[\s\-]*(\d{3})[\s\-]*([A-Z]{2})/;
  const match = cleaned.match(georgianPlateRegex);
  
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  
  // Try looser pattern (just letters and numbers)
  const looseRegex = /([A-Z]{2}\d{3}[A-Z]{2})/;
  const looseMatch = cleaned.match(looseRegex);
  
  if (looseMatch) {
    const plate = looseMatch[1];
    return `${plate.slice(0, 2)}-${plate.slice(2, 5)}-${plate.slice(5)}`;
  }
  
  // Return the cleaned text if it looks like a plate (5-8 alphanumeric chars)
  const words = cleaned.split(/\s+/);
  for (const word of words) {
    const alphanumeric = word.replace(/[^A-Z0-9]/g, '');
    if (alphanumeric.length >= 5 && alphanumeric.length <= 8) {
      // Check if it has both letters and numbers
      if (/[A-Z]/.test(alphanumeric) && /\d/.test(alphanumeric)) {
        return alphanumeric;
      }
    }
  }
  
  return null;
};
