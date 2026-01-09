# Invoice Sync Fix - Summary

## Problem Identified
Invoice updates were being saved to Firebase but NOT syncing to cPanel database. Root cause: The `makeRequest()` function in `cpanelService.js` was not including the request body for PUT requests.

## Root Cause
Line 33 of `cpanelService.js` had:
```javascript
if (data && (method === 'POST' || method === 'DELETE')) {
  options.body = JSON.stringify(data);
}
```

This meant PUT requests to `update-invoice.php` were sent WITHOUT any body data, so the PHP endpoint couldn't receive the update payload.

## Changes Made

### 1. Fixed makeRequest() in cpanelService.js
- **Added 'PUT'** to the conditional that includes request body
- **Added GET support** for query parameters (needed for fetching cPanel invoice IDs)
- New code handles all HTTP methods properly:
  - POST/PUT/DELETE: Send data in request body
  - GET: Append data as query parameters

### 2. Added fetchCPanelInvoiceId() function
- New function in `cpanelService.js` to retrieve cPanel invoice ID by Firebase ID
- Uses the new `get-invoice-id.php` endpoint
- Returns cPanel ID for caching if not already stored

### 3. Enhanced all save handlers in cases/[id].tsx
- **handleUpdateStatus()** - Now fetches cPanel ID if not cached
- **handleSaveCustomerInfo()** - Now fetches cPanel ID if not cached
- **handleSaveChanges()** - Now fetches cPanel ID if not cached
- **handleAddService()** - Now fetches cPanel ID if not cached

### 4. Added getCPanelInvoiceId() helper in cases/[id].tsx
- Calls `fetchCPanelInvoiceId()` from cpanelService if not already cached
- Updates local state with the ID for future operations
- Returns the cPanel ID to be passed to `updateInspection()`

## Testing Instructions

### Test 1: Update Service Price
1. Open the mobile app
2. Click on an existing invoice in the "Open Cases" list
3. Click the edit icon in Services section
4. Change a service price (e.g., 100 ₾ to 150 ₾)
5. Click "Save Changes"
6. Check cPanel phpMyAdmin:
   - Look at `otoexpre_userdb`.`transfers` table
   - Find the invoice row
   - Check that the `amount` column is updated to the new total price
   - Check that `repair_labor` column contains the updated service JSON

**Expected Result:** Update appears in cPanel within seconds

### Test 2: Update Customer Name
1. Open an existing invoice
2. Click the edit icon in Customer Info section
3. Change the customer name
4. Click "Save Changes"
5. Check cPanel - `transfers` table
6. Verify the `name` column is updated

**Expected Result:** Customer name is updated in cPanel

### Test 3: Change Status
1. Open an existing invoice
2. Click "Change Status"
3. Select "In Progress" or "Completed"
4. Check cPanel - `transfers` table
5. Verify the `status` column is updated

**Expected Result:** Status is updated in cPanel

### Test 4: Add New Service
1. Open an existing invoice
2. Click "Add Service"
3. Select a service from the dropdown or enter custom name/price
4. Click "Save Service"
5. Check cPanel - `transfers` table
6. Verify the `repair_labor` column contains the new service in JSON format

**Expected Result:** New service appears in cPanel database

## How It Works Now

1. **User makes an update** (changes service price, customer name, etc.)
2. **Handler gets cPanel ID:**
   - If `cpanelInvoiceId` state is already set (cached from initial load), use it
   - If not cached, call `getCPanelInvoiceId()` which fetches from cPanel via `get-invoice-id.php`
3. **Firebase update happens first** (primary data source)
4. **cPanel sync happens in background** (via `updateInvoiceToCPanel()`)
5. **makeRequest() now properly includes body** for PUT requests
6. **update-invoice.php receives the update payload** and updates the database

## Files Modified

1. **src/services/cpanelService.js**
   - Fixed `makeRequest()` to include PUT in body condition
   - Added GET query parameter support
   - Added `fetchCPanelInvoiceId()` function
   - Updated default export

2. **app/cases/[id].tsx**
   - Added `getCPanelInvoiceId()` helper function
   - Updated `handleUpdateStatus()` to fetch ID if needed
   - Updated `handleSaveCustomerInfo()` to fetch ID if needed
   - Updated `handleSaveChanges()` to fetch ID if needed
   - Updated `handleAddService()` to fetch ID if needed
   - Added console logging for debugging

## Debugging

If updates still don't appear in cPanel after testing:

1. **Check console logs:**
   - Look for: `[Case Detail] Saving with cPanel ID: <number>`
   - Look for: `[cPanel API] Update payload: {...}`

2. **Verify cPanel invoice ID is being stored:**
   - Check Firebase: Open a document in `inspections` collection
   - Should have `cpanelInvoiceId` field after first sync

3. **Check cPanel error logs:**
   - If `get-invoice-id.php` is failing, check PHP error logs
   - If `update-invoice.php` is failing, check HTTP response body in console

4. **Manual test with curl:**
   ```bash
   curl -X PUT https://portal.otoexpress.ge/api/mobile-sync/update-invoice.php \
     -H "X-API-Key: m3RZpQRAKCv8X9JtY2hpbGxAZXhhbXBsZS5jb20=" \
     -H "Content-Type: application/json" \
     -d '{"invoiceId":123,"customerName":"Test","totalPrice":500}'
   ```

## Next Steps

After confirming updates are syncing from mobile to cPanel:
1. Implement pull from cPanel → Mobile (listen for external updates)
2. Add timestamp tracking for conflict resolution
3. Add sync status indicator in UI
