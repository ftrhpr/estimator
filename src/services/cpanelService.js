/**
 * cPanel API Integration Service
 * Syncs invoices from Firebase to cPanel hosting database
 */

const CPANEL_API_URL = process.env.EXPO_PUBLIC_CPANEL_API_URL || '';
const CPANEL_API_KEY = process.env.EXPO_PUBLIC_CPANEL_API_KEY || '';

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
    console.log(`[cPanel API] Headers:`, options.headers);
    console.log(`[cPanel API] API Key (first 10 chars): ${CPANEL_API_KEY.substring(0, 10)}...`);
    console.log(`[cPanel API] API Key length: ${CPANEL_API_KEY.length}`);
    if (data && method !== 'GET') {
      console.log(`[cPanel API] Request body:`, data);
    }
    
    const response = await fetch(url, options);
    let responseData = null;
    
    try {
      // Read response body as text first
      const responseText = await response.text();
      
      // Try to parse as JSON
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        // If JSON parsing fails, use the raw text
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
    
    // Prepare data for cPanel API - mapped to transfers table structure
    const payload = {
      firebaseId: firebaseId,
      customerName: invoiceData.customerName || 'N/A',
      customerPhone: invoiceData.customerPhone || '',
      carModel: invoiceData.carModel || 'Unknown', // Maps to 'plate' column
      totalPrice: invoiceData.totalPrice || 0,      // Maps to 'amount' column
      services: invoiceData.services || [],         // Stored in systemLogs
      parts: invoiceData.parts || [],               // Stored in parts JSON column
      photosCount: invoiceData.photos?.length || 0, // Stored in systemLogs
      partsCount: invoiceData.parts?.length || 0,   // Stored in systemLogs
      status: invoiceData.status || 'New',          // Maps to 'status' column
      serviceDate: invoiceData.createdAt || new Date().toISOString(),
      createdAt: invoiceData.createdAt || new Date().toISOString(),
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
    
    // Don't throw error - we don't want to block the app if cPanel sync fails
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
      
      // Small delay to avoid overwhelming the server
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
    console.log('[cPanel API] cPanel not configured, skipping delete');
    return {
      success: false,
      skipped: true,
      reason: 'Not configured',
    };
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
    
    // Don't throw error - we don't want to block the app if cPanel delete fails
    return {
      success: false,
      error: error.message,
      invoiceId: invoiceId,
    };
  }
};

/**
 * Update an invoice in cPanel
 * @param {string} invoiceId - cPanel invoice ID to update
 * @param {object} updateData - Data to update (customerName, customerPhone, carModel, totalPrice, services, parts, status, etc.)
 * @returns {Promise<object>} Update result
 */
export const updateInvoiceToCPanel = async (invoiceId, updateData) => {
  if (!isCPanelConfigured()) {
    console.log('[cPanel API] cPanel not configured, skipping update');
    return {
      success: false,
      skipped: true,
      reason: 'Not configured',
    };
  }
  
  if (!invoiceId) {
    console.log('[cPanel API] No cPanel invoice ID provided, skipping update');
    return {
      success: false,
      reason: 'No cPanel ID',
    };
  }
  
  try {
    console.log('[cPanel API] Updating invoice:', invoiceId);
    
    // Prepare update payload - only include fields that were provided
    const payload = {
      invoiceId: invoiceId,
      ...updateData,
    };
    
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
    
    // Don't throw error - we don't want to block the app if cPanel update fails
    return {
      success: false,
      error: error.message,
      invoiceId: invoiceId,
    };
  }
};

/**
 * Check sync status of an invoice
 * @param {string} firebaseId - Firebase document ID
 * @returns {Promise<object>} Sync status
 */
export const checkSyncStatus = async (firebaseId) => {
  try {
    // This would require an additional endpoint on cPanel
    // For now, return not implemented
    return {
      success: false,
      error: 'Not implemented yet',
    };
  } catch (error) {
    console.error('[cPanel API] Check status error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Fetch cPanel invoice ID by Firebase document ID
 * @param {string} firebaseId - Firebase document ID
 * @returns {Promise<string|null>} cPanel invoice ID if found
 */
export const fetchCPanelInvoiceId = async (firebaseId) => {
  if (!isCPanelConfigured()) {
    console.log('[cPanel API] cPanel not configured, cannot fetch invoice ID');
    return null;
  }
  
  try {
    console.log('[cPanel API] Fetching cPanel invoice ID for Firebase ID:', firebaseId);
    
    const response = await makeRequest('get-invoice-id.php', { firebaseId }, 'GET');
    
    if (response.success && response.cpanelInvoiceId) {
      console.log('[cPanel API] Found cPanel invoice ID:', response.cpanelInvoiceId);
      return response.cpanelInvoiceId;
    }
    
    console.log('[cPanel API] cPanel invoice ID not found for Firebase ID:', firebaseId);
    return null;
  } catch (error) {
    console.error('[cPanel API] Error fetching invoice ID:', error);
    return null;
  }
};

/**
 * Fetch invoice data from cPanel (for syncing updates from cPanel back to app)
 * @param {string} cpanelInvoiceId - cPanel invoice ID
 * @param {string} firebaseId - Firebase document ID (optional, if cpanelInvoiceId not available)
 * @returns {Promise<object|null>} Invoice data in app format or null if not found
 */
export const fetchInvoiceFromCPanel = async (cpanelInvoiceId = null, firebaseId = null) => {
  if (!isCPanelConfigured()) {
    console.log('[cPanel API] cPanel not configured, cannot fetch invoice');
    return null;
  }
  
  if (!cpanelInvoiceId && !firebaseId) {
    console.log('[cPanel API] No invoice ID provided');
    return null;
  }
  
  try {
    console.log('[cPanel API] Fetching invoice from cPanel:', { cpanelInvoiceId, firebaseId });
    
    const params = {
      fullData: 'true', // Request full invoice data, not just ID
    };
    if (cpanelInvoiceId) {
      params.invoiceId = cpanelInvoiceId;
    }
    if (firebaseId) {
      params.firebaseId = firebaseId;
    }
    
    // Use existing get-invoice-id.php endpoint with fullData parameter
    const response = await makeRequest('get-invoice-id.php', params, 'GET');
    
    if (response.success && response.data) {
      console.log('[cPanel API] Invoice fetched successfully:', response.data);
      return response.data;
    }
    
    console.log('[cPanel API] Invoice not found in cPanel');
    return null;
  } catch (error) {
    console.error('[cPanel API] Error fetching invoice:', error);
    return null;
  }
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
  isCPanelConfigured,
};
