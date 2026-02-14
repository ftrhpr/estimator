/**
 * cPanel API Integration Service
 * Syncs invoices from Firebase to cPanel hosting database
 */

import { DEFAULT_SERVICES } from '../config/services';

const CPANEL_API_URL = process.env.EXPO_PUBLIC_CPANEL_API_URL || '';
const CPANEL_API_KEY = process.env.EXPO_PUBLIC_CPANEL_API_KEY || '';

/**
 * Get Georgian service name from English name or service key
 * @param {string} serviceName - English service name or key
 * @returns {string} Georgian service name
 */
const getGeorgianServiceName = (serviceName) => {
  if (!serviceName) return '';
  
  // First check by key
  const serviceKey = serviceName.toLowerCase().replace(/\s+/g, '_');
  if (DEFAULT_SERVICES[serviceKey]) {
    return DEFAULT_SERVICES[serviceKey].nameKa;
  }
  
  // Then check by English name
  for (const key of Object.keys(DEFAULT_SERVICES)) {
    const service = DEFAULT_SERVICES[key];
    if (service.nameEn.toLowerCase() === serviceName.toLowerCase()) {
      return service.nameKa;
    }
  }
  
  return serviceName;
};

/**
 * Transform services array to use Georgian names
 * @param {Array} services - Array of service objects
 * @returns {Array} Services with Georgian names
 */
const transformServicesToGeorgian = (services) => {
  if (!Array.isArray(services)) return [];
  
  console.log('[cPanel Service] transformServicesToGeorgian called with', services.length, 'services');
  
  return services.map((service, index) => {
    // Log EVERY field of the service object
    console.log(`[cPanel Service] Service ${index} FULL OBJECT:`, JSON.stringify(service));
    
    // Get name from ALL possible fields - be very comprehensive
    let georgianName = '';
    
    // Try all possible name fields in priority order
    const possibleNames = [
      service.serviceNameKa,
      service.nameKa,
      service.serviceName,
      service.name,
      service.description,
    ];
    
    console.log(`[cPanel Service] Service ${index} possibleNames:`, possibleNames);
    
    for (const name of possibleNames) {
      if (name && typeof name === 'string' && name.trim()) {
        // Check if it's a Georgian name lookup needed
        const trimmed = name.trim();
        const lookedUp = getGeorgianServiceName(trimmed);
        georgianName = (lookedUp && lookedUp.trim()) ? lookedUp : trimmed;
        console.log(`[cPanel Service] Service ${index} found name: "${georgianName}" from field with value "${trimmed}"`);
        break;
      }
    }
    
    // Final fallback: Generic name with index
    if (!georgianName) {
      georgianName = `სერვისი ${index + 1}`;
      console.warn(`[cPanel Service] Service at index ${index} has no name, using fallback. Fields:`, {
        serviceNameKa: service.serviceNameKa,
        nameKa: service.nameKa,
        serviceName: service.serviceName,
        name: service.name,
        description: service.description,
      });
    }
    
    console.log(`[cPanel Service] Service transform: Input names = [${service.serviceNameKa || 'N/A'}, ${service.serviceName || 'N/A'}, ${service.name || 'N/A'}] -> "${georgianName}"`);
    
    // Calculate discounted price if discount exists
    const discountPercent = service.discount_percent || 0;
    const basePrice = service.price || 0;
    const discountedPrice = basePrice * (1 - discountPercent / 100);
    
    return {
      ...service,
      serviceName: georgianName,
      serviceNameKa: georgianName,
      name: georgianName,  // Also set 'name' field for PHP compatibility
      nameKa: georgianName, // Backup field
      originalName: service.serviceName || service.name || '',
      discount_percent: discountPercent,
      discountedPrice: discountedPrice,
    };
  });
};

/**
 * Map app status values to cPanel status values
 * @param {string} appStatus - Status from the app
 * @returns {string} Status for cPanel
 */
const mapStatusToCPanel = (appStatus) => {
  const statusMap = {
    'In Service': 'Already in service', // App uses "In Service", cPanel uses "Already in service"
    'Already in service': 'Already in service',
  };
  
  return statusMap[appStatus] || appStatus;
};

// Check if cPanel integration is configured
export const isCPanelConfigured = () => {
  return CPANEL_API_URL && CPANEL_API_KEY;
};

/**
 * Make API request to cPanel
 * @param {string} endpoint - API endpoint (e.g., 'create-invoice.php')
 * @param {object} data - Request payload
 * @param {string} method - HTTP method (default: POST)
 * @returns {Promise<object>} API response
 */
const makeRequest = async (endpoint, data = null, method = 'POST') => {
  try {
    let url = `${CPANEL_API_URL}/${endpoint}`;
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': CPANEL_API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'AutoBodyEstimator/1.0 (Mobile App)',
      },
    };
    
    // For GET requests, append query parameters
    if (method === 'GET' && data) {
      const queryParams = new URLSearchParams();
      Object.keys(data).forEach(key => {
        queryParams.append(key, data[key]);
      });
      url = `${url}?${queryParams.toString()}`;
    } else if (data && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
      // Add body for POST, PUT and DELETE requests with data
      options.body = JSON.stringify(data);
    }
    
    console.log(`[cPanel API] ${method} ${url}`);
    if (data && method !== 'GET') {
      console.log(`[cPanel API] Request body:`, data);
    }
    
    const response = await fetch(url, options);
    let responseData = null;
    
    try {
      const responseText = await response.text();
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.warn('[cPanel API] Response is not JSON, using raw text');
        responseData = {
          success: !response.ok,
          message: `HTTP ${response.status}`,
          raw: responseText
        };
      }
    } catch (readError) {
      console.error('[cPanel API] Failed to read response body:', readError);
      responseData = {
        success: false,
        message: `HTTP ${response.status}: ${readError.message}`,
        raw: null
      };
    }
    
    if (!response.ok) {
      console.error(`[cPanel API] Response status: ${response.status}`);
      console.error(`[cPanel API] Response:`, responseData);
      throw new Error(responseData.error || responseData.message || `HTTP ${response.status}`);
    }
    
    console.log('[cPanel API] Response:', responseData);
    return responseData;
  } catch (error) {
    console.error('[cPanel API] Error:', error.message);
    throw error;
  }
};

/**
 * Test cPanel API connection
 * @returns {Promise<object>} Test result
 */
export const testConnection = async () => {
  try {
    if (!isCPanelConfigured()) {
      return {
        success: false,
        error: 'cPanel API not configured. Check .env file.',
        configured: false,
      };
    }
    
    const response = await makeRequest('test.php', {}, 'POST');
    console.log('[cPanel API] Connection test successful:', response);
    return {
      success: true,
      configured: true,
      ...response,
    };
  } catch (error) {
    console.error('[cPanel API] Connection test failed:', error);
    return {
      success: false,
      configured: true,
      error: error.message,
    };
  }
};

/**
 * Sync invoice to cPanel database
 * @param {object} invoiceData - Invoice data from Firebase
 * @param {string} firebaseId - Firebase document ID
 * @returns {Promise<object>} Sync result
 */
export const syncInvoiceToCPanel = async (invoiceData, firebaseId) => {
  try {
    if (!isCPanelConfigured()) {
      console.warn('[cPanel API] Not configured, skipping sync');
      return {
        success: false,
        skipped: true,
        reason: 'Not configured',
      };
    }
    
    const georgianServices = transformServicesToGeorgian(invoiceData.services || []);
    
    // --- Enrich photos with tagging information ---
    // Maps each photo to its associated damage tags from the parts array
    const photoUrls = invoiceData.photos || invoiceData.imageURL || invoiceData.imageUrls || [];
    
    const enrichedPhotos = photoUrls.map((photoData, photoIndex) => {
      // Extract photo URL and metadata
      const photoUrl = typeof photoData === 'string' ? photoData : (photoData.url || photoData);
      const photoLabel = typeof photoData === 'object' ? (photoData.label || `Photo ${photoIndex + 1}`) : `Photo ${photoIndex + 1}`;
      
      // Find all tags/damage data for this specific photo
      const photoTags = [];
      if (invoiceData.parts && Array.isArray(invoiceData.parts)) {
        invoiceData.parts.forEach(part => {
          if (part.damages && Array.isArray(part.damages)) {
            part.damages.forEach(damage => {
              // Match damage to this photo by index
              if (damage.photoIndex === photoIndex || damage.photoIndex === photoIndex.toString()) {
                if (damage.services && Array.isArray(damage.services)) {
                  damage.services.forEach(service => {
                    photoTags.push({
                      serviceName: service.name || part.partName || 'Unknown',
                      servicePrice: service.price || 0,
                      x: damage.x || 0,
                      y: damage.y || 0,
                      xPercent: damage.xPercent || 0,
                      yPercent: damage.yPercent || 0,
                    });
                  });
                }
              }
            });
          }
        });
      }
      
      // Return enriched photo object with tags
      return {
        url: photoUrl,
        label: photoLabel,
        tags: photoTags,
        tagCount: photoTags.length,
        uploadedAt: (typeof photoData === 'object' ? photoData.uploadedAt : null) || new Date().toISOString(),
      };
    });
    
    // Enhanced debugging log
    console.log('[cPanel API] Photos enriched with tagging info:', {
      totalPhotos: enrichedPhotos.length,
      photosWithTags: enrichedPhotos.filter(p => p.tagCount > 0).length,
      totalTags: enrichedPhotos.reduce((sum, p) => sum + p.tagCount, 0),
      photoDetails: enrichedPhotos.map(p => ({
        label: p.label,
        tagCount: p.tagCount,
        tags: p.tags,
      })),
    });
    
    const payload = {
      firebaseId: firebaseId,
      customerName: invoiceData.customerName || 'N/A',
      customerPhone: invoiceData.customerPhone || '',
      plate: invoiceData.plate || 'N/A',
      vehicleMake: invoiceData.carMake || '',
      vehicleModel: invoiceData.carModel || '',
      totalPrice: invoiceData.totalPrice || 0,
      services: georgianServices,
      parts: invoiceData.parts || [],
      photos: enrichedPhotos,  // Send enriched photos with tagging information
      photosCount: enrichedPhotos.length,
      partsCount: invoiceData.parts?.length || 0,
      status: invoiceData.status || 'New',
      serviceDate: invoiceData.createdAt || new Date().toISOString(),
      createdAt: invoiceData.createdAt || new Date().toISOString(),
      includeVAT: invoiceData.includeVAT || false,
      vatAmount: invoiceData.vatAmount || 0,
      vatRate: invoiceData.vatRate || 0,
      subtotalBeforeVAT: invoiceData.subtotalBeforeVAT || 0,
    };
    
    console.log('[cPanel API] Syncing invoice:', firebaseId);
    
    const response = await makeRequest('create-invoice.php', payload);
    
    console.log('[cPanel API] Sync successful:', response);
    
    return {
      success: true,
      cpanelId: response.data?.id,
      firebaseId: firebaseId,
      message: response.data?.message || 'Synced successfully',
    };
  } catch (error) {
    console.error('[cPanel API] Sync failed:', error);
    return {
      success: false,
      error: error.message,
      firebaseId: firebaseId,
    };
  }
};

/**
 * Batch sync multiple invoices (for initial setup or recovery)
 * @param {Array<object>} invoices - Array of invoice objects with firebaseId
 * @returns {Promise<object>} Batch sync results
 */
export const batchSyncInvoices = async (invoices) => {
  try {
    if (!isCPanelConfigured()) {
      return {
        success: false,
        error: 'cPanel API not configured',
        results: [],
      };
    }
    
    console.log(`[cPanel API] Batch syncing ${invoices.length} invoices`);
    
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    for (const invoice of invoices) {
      const result = await syncInvoiceToCPanel(invoice.data, invoice.id);
      results.push({
        firebaseId: invoice.id,
        ...result,
      });
      
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`[cPanel API] Batch sync complete: ${successCount} success, ${failCount} failed`);
    
    return {
      success: true,
      total: invoices.length,
      successCount,
      failCount,
      results,
    };
  } catch (error) {
    console.error('[cPanel API] Batch sync error:', error);
    return {
      success: false,
      error: error.message,
      results: [],
    };
  }
};

/**
 * Delete an invoice from cPanel
 * @param {string} invoiceId - cPanel invoice ID to delete
 * @returns {Promise<object>} Delete result
 */
export const deleteInvoiceFromCPanel = async (invoiceId) => {
  if (!isCPanelConfigured()) {
    return { success: false, skipped: true, reason: 'Not configured' };
  }
  
  try {
    console.log('[cPanel API] Deleting invoice:', invoiceId);
    const response = await makeRequest('delete-invoice.php', { invoiceId }, 'DELETE');
    console.log('[cPanel API] Delete successful:', response);
    return {
      success: response.success !== false,
      invoiceId: invoiceId,
      message: response.message || 'Deleted successfully',
    };
  } catch (error) {
    console.error('[cPanel API] Delete failed:', error);
    return { success: false, error: error.message, invoiceId: invoiceId };
  }
};

/**
 * Update an invoice in cPanel
 * @param {string} invoiceId - cPanel invoice ID to update
 * @param {object} updateData - Data to update
 * @returns {Promise<object>} Update result
 */
export const updateInvoiceToCPanel = async (invoiceId, updateData) => {
  if (!isCPanelConfigured()) {
    return { success: false, skipped: true, reason: 'Not configured' };
  }
  
  if (!invoiceId) {
    return { success: false, reason: 'No cPanel ID' };
  }
  
  try {
    console.log('[cPanel API] Updating invoice:', invoiceId);
    console.log('[cPanel API] Raw updateData.services:', JSON.stringify(updateData.services, null, 2));
    
    // Transform services to ensure proper name fields
    let transformedServices = updateData.services;
    if (updateData.services && Array.isArray(updateData.services)) {
      transformedServices = transformServicesToGeorgian(updateData.services);
      console.log('[cPanel API] Services AFTER transform:', JSON.stringify(transformedServices, null, 2));
    }
    
    const payload = {
      invoiceId: invoiceId,
      ...updateData,
      services: transformedServices, // Use transformed services
    };
    
    // Map status to cPanel format if provided
    if (payload.status) {
      payload.status = mapStatusToCPanel(payload.status);
      console.log('[cPanel API] Status mapped:', updateData.status, '->', payload.status);
    }
    
    // Log the final services in payload
    console.log('[cPanel API] FINAL payload.services:', JSON.stringify(payload.services, null, 2));
    
    // --- KEY CHANGE: Robustly find and normalize photo URLs for updates ---
    const photoUrls = payload.photos || payload.imageURL || payload.imageUrls;
    if (photoUrls !== undefined) { // Check for undefined to handle empty arrays correctly
        payload.photos = photoUrls;
        // Clean up other variants to avoid sending confusing/duplicate data
        if (payload.imageURL) delete payload.imageURL;
        if (payload.imageUrls) delete payload.imageUrls;
    }
    
    console.log('[cPanel API] Update payload:', payload);
    
    const response = await makeRequest('update-invoice.php', payload, 'PUT');
    
    console.log('[cPanel API] Update successful:', response);
    
    return {
      success: response.success !== false,
      invoiceId: invoiceId,
      message: response.message || 'Updated successfully',
      data: response.data || {},
    };
  } catch (error) {
    console.error('[cPanel API] Update failed:', error);
    return { success: false, error: error.message, invoiceId: invoiceId };
  }
};

/**
 * Check sync status of an invoice
 * @param {string} firebaseId - Firebase document ID
 * @returns {Promise<object>} Sync status
 */
export const checkSyncStatus = async (firebaseId) => {
  return { success: false, error: 'Not implemented yet' };
};

/**
 * Fetch cPanel invoice ID by Firebase document ID
 * @param {string} firebaseId - Firebase document ID
 * @returns {Promise<string|null>} cPanel invoice ID if found
 */
export const fetchCPanelInvoiceId = async (firebaseId) => {
  if (!isCPanelConfigured()) return null;
  
  try {
    console.log('[cPanel API] Fetching cPanel invoice ID for Firebase ID:', firebaseId);
    const response = await makeRequest('get-invoice-id.php', { firebaseId }, 'GET');
    const cpanelId = response.data?.cpanelInvoiceId || response.cpanelInvoiceId;
    
    if (response.success && cpanelId) {
      console.log('[cPanel API] Found cPanel invoice ID:', cpanelId);
      return cpanelId;
    }
    return null;
  } catch (error) {
    console.error('[cPanel API] Error fetching invoice ID:', error);
    return null;
  }
};

/**
 * Fetch invoice data from cPanel
 * @param {string} cpanelInvoiceId - cPanel invoice ID
 * @param {string} firebaseId - Firebase document ID (optional)
 * @returns {Promise<object|null>} Invoice data
 */
export const fetchInvoiceFromCPanel = async (cpanelInvoiceId = null, firebaseId = null) => {
  if (!isCPanelConfigured() || (!cpanelInvoiceId && !firebaseId)) return null;

  try {
    const params = { fullData: 'true' };
    if (cpanelInvoiceId) params.invoiceId = cpanelInvoiceId;
    if (firebaseId) params.firebaseId = firebaseId;

    console.log('[cPanel API] Fetching invoice from cPanel:', params);

    const response = await makeRequest('get-invoice-id.php', params, 'GET');

    if (response.success && response.data) {
      console.log('[cPanel API] Invoice fetched successfully:', response.data);
      return response.data;
    }
    return null;
  } catch (error) {
    console.error('[cPanel API] Error fetching invoice:', error);
    return null;
  }
};

/**
 * Fetch all invoices from cPanel database
 * @param {object} [options] - Optional filters
 * @param {number} [options.limit] - Max number of invoices (default: 100, max: 500)
 * @param {number} [options.offset] - Offset for pagination (default: 0)
 * @param {boolean} [options.onlyCPanelOnly] - Only fetch invoices not synced with Firebase
 * @returns {Promise<{success: boolean, invoices: Array<any>, total?: number, hasMore?: boolean, error?: string}>}
 */
export const fetchAllCPanelInvoices = async (options = {}) => {
  if (!isCPanelConfigured()) {
    console.warn('[cPanel API] Not configured, cannot fetch invoices');
    return {
      success: false,
      invoices: [],
      error: 'cPanel API not configured',
    };
  }

  try {
    const params = {
      limit: options.limit || 100,
      offset: options.offset || 0,
      onlyCPanelOnly: options.onlyCPanelOnly ? 'true' : 'false',
    };

    console.log('[cPanel API] Fetching all invoices with params:', params);

    const response = await makeRequest('get-all-invoices.php', params, 'GET');

    if (response.success && response.data) {
      console.log(`[cPanel API] Fetched ${response.data.invoices?.length || 0} invoices from cPanel`);
      return {
        success: true,
        invoices: response.data.invoices || [],
        total: response.data.total || 0,
        hasMore: response.data.hasMore || false,
        limit: response.data.limit,
        offset: response.data.offset,
      };
    }

    return {
      success: false,
      invoices: [],
      error: response.error || 'Unknown error',
    };
  } catch (error) {
    console.error('[cPanel API] Error fetching all invoices:', error);
    return {
      success: false,
      invoices: [],
      error: error.message,
    };
  }
};

/**
 * Fetch payments for a specific transfer/invoice from cPanel
 * @param {string|number} transferId - The cPanel transfer/invoice ID
 * @returns {Promise<{success: boolean, payments: Array, totalPaid: number, error?: string}>}
 */
export const fetchPaymentsFromCPanel = async (transferId) => {
  if (!isCPanelConfigured() || !transferId) {
    return { success: false, payments: [], totalPaid: 0, error: 'Invalid parameters' };
  }

  try {
    const response = await makeRequest('get-payments.php', { transferId }, 'GET');

    if (response.success && response.data) {
      console.log(`[cPanel API] Fetched ${response.data.payments?.length || 0} payments`);
      return {
        success: true,
        payments: response.data.payments || [],
        totalPaid: response.data.totalPaid || 0,
      };
    }

    return { success: false, payments: [], totalPaid: 0, error: response.error };
  } catch (error) {
    console.error('[cPanel API] Error fetching payments:', error);
    return { success: false, payments: [], totalPaid: 0, error: error.message };
  }
};

/**
 * Create a new payment record in cPanel
 * @param {object} paymentData - Payment data
 * @param {number} paymentData.transferId - The cPanel transfer/invoice ID
 * @param {number} paymentData.amount - Payment amount
 * @param {string} paymentData.paymentMethod - Payment method (Cash, Transfer)
 * @param {string} [paymentData.method] - Sub-method for transfers (BOG, TBC)
 * @param {string} [paymentData.reference] - Payment reference
 * @param {string} [paymentData.notes] - Payment notes
 * @param {string} [paymentData.paymentDate] - Payment date
 * @returns {Promise<{success: boolean, payment?: object, totalPaid?: number, error?: string}>}
 */
export const createPaymentInCPanel = async (paymentData) => {
  if (!isCPanelConfigured() || !paymentData.transferId || !paymentData.amount) {
    return { success: false, error: 'Invalid parameters' };
  }

  try {
    console.log('[cPanel API] Creating payment:', paymentData);
    const response = await makeRequest('create-payment.php', paymentData, 'POST');

    if (response.success && response.data) {
      console.log('[cPanel API] Payment created:', response.data);
      return {
        success: true,
        payment: response.data.payment,
        totalPaid: response.data.totalPaid,
        id: response.data.id,
      };
    }

    return { success: false, error: response.error };
  } catch (error) {
    console.error('[cPanel API] Error creating payment:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a payment record from cPanel
 * @param {number} paymentId - The payment ID to delete
 * @returns {Promise<{success: boolean, totalPaid?: number, error?: string}>}
 */
export const deletePaymentFromCPanel = async (paymentId) => {
  if (!isCPanelConfigured() || !paymentId) {
    return { success: false, error: 'Invalid parameters' };
  }

  try {
    console.log('[cPanel API] Deleting payment:', paymentId);
    const response = await makeRequest('delete-payment.php', { paymentId }, 'DELETE');

    if (response.success && response.data) {
      console.log('[cPanel API] Payment deleted:', response.data);
      return {
        success: true,
        totalPaid: response.data.totalPaid,
      };
    }

    return { success: false, error: response.error };
  } catch (error) {
    console.error('[cPanel API] Error deleting payment:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Fetch list of mechanics from cPanel database
 * @returns {Promise<{success: boolean, mechanics: Array<{id: number, name: string}>, error?: string}>}
 */
export const fetchMechanicsFromCPanel = async () => {
  if (!isCPanelConfigured()) {
    return { success: false, mechanics: [], error: 'cPanel API not configured' };
  }

  try {
    console.log('[cPanel API] Fetching mechanics list');
    const response = await makeRequest('get-mechanics.php', null, 'GET');

    if (response.success && response.data) {
      console.log(`[cPanel API] Fetched ${response.data.mechanics?.length || 0} mechanics`);
      return {
        success: true,
        mechanics: response.data.mechanics || [],
      };
    }

    return { success: false, mechanics: [], error: response.error };
  } catch (error) {
    console.error('[cPanel API] Error fetching mechanics:', error);
    return { success: false, mechanics: [], error: error.message };
  }
};

/**
 * Generic fetch from cPanel API
 * @param {string} endpoint - API endpoint (e.g., 'get-statuses.php')
 * @param {object} options - Request options with method and optional data
 * @returns {Promise<object>} API response
 */
/**
 * Fetch aggregate payment analytics data from cPanel
 * Returns totals, breakdowns by method/mechanic/month, and outstanding invoices
 */
export const fetchAllPaymentsAnalytics = async () => {
  if (!isCPanelConfigured()) {
    console.warn('[cPanel] Not configured - skipping payment analytics fetch');
    return { success: false, data: null };
  }

  try {
    const response = await makeRequest('get-all-payments.php', null, 'GET');
    return response;
  } catch (error) {
    console.error('[cPanel] Error fetching payment analytics:', error);
    return { success: false, data: null, error: error.message };
  }
};

export const fetchFromCPanel = async (endpoint, options = {}) => {
  console.log('[cpanelService] fetchFromCPanel called with endpoint:', endpoint);
  console.log('[cpanelService] CPANEL_API_URL:', CPANEL_API_URL ? 'SET' : 'NOT SET');
  console.log('[cpanelService] CPANEL_API_KEY:', CPANEL_API_KEY ? 'SET (length: ' + CPANEL_API_KEY.length + ')' : 'NOT SET');
  
  if (!isCPanelConfigured()) {
    throw new Error('cPanel API not configured');
  }

  const method = options.method || 'GET';
  const data = options.data || null;

  return await makeRequest(endpoint, data, method);
};

export default {
  testConnection,
  syncInvoiceToCPanel,
  updateInvoiceToCPanel,
  deleteInvoiceFromCPanel,
  batchSyncInvoices,
  checkSyncStatus,
  fetchCPanelInvoiceId,
  fetchInvoiceFromCPanel,
  fetchAllCPanelInvoices,
  fetchPaymentsFromCPanel,
  createPaymentInCPanel,
  deletePaymentFromCPanel,
  fetchMechanicsFromCPanel,
  fetchAllPaymentsAnalytics,
  fetchFromCPanel,
  isCPanelConfigured,
};