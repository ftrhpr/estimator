# cPanel Integration Guide

## Overview
This guide will help you sync invoices from your React Native app to your cPanel hosting database in real-time.

## Architecture
```
Mobile App (React Native + Firebase)
         ↓
    API Request
         ↓
cPanel Server (PHP + MySQL)
         ↓
    transfers table
```

---

## Part 1: Database Structure Analysis Needed

Please provide the following information about your **transfers** table:

### 1. Database Connection Details
- Database Host: `localhost` or IP
- Database Name: 
- Database Username: 
- Database Password: 
- Database Port: (usually 3306)

### 2. Table Structure
Run this SQL query and share the result:
```sql
DESCRIBE transfers;
-- OR
SHOW CREATE TABLE transfers;
```

### 3. Sample Data Format
Share a sample INSERT query or the columns you're using:
```sql
-- Example:
SELECT * FROM transfers LIMIT 1;
```

---

## Part 2: cPanel Server Setup (PHP API)

### Step 1: Create API Directory on cPanel
1. Login to cPanel File Manager
2. Navigate to `public_html/` (or your domain root)
3. Create folder: `api/`
4. Inside `api/`, create: `mobile-sync/`

### Step 2: Create Database Configuration File
**File: `public_html/api/mobile-sync/config.php`**

```php
<?php
// Prevent direct access
if (!defined('API_ACCESS')) {
    die('Direct access not permitted');
}

// Database configuration
define('DB_HOST', 'localhost');
define('DB_NAME', 'your_database_name');
define('DB_USER', 'your_database_user');
define('DB_PASS', 'your_database_password');
define('DB_CHARSET', 'utf8mb4');

// API Security Key (generate a random string)
define('API_KEY', 'your-secret-api-key-here-change-this-12345');

// Enable error reporting for development (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Set timezone
date_default_timezone_set('Asia/Tbilisi'); // Georgia timezone

// CORS headers for React Native
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key');
header('Content-Type: application/json; charset=UTF-8');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database connection function
function getDBConnection() {
    try {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        return $pdo;
    } catch (PDOException $e) {
        error_log("Database connection failed: " . $e->getMessage());
        throw new Exception("Database connection failed");
    }
}

// Verify API key
function verifyAPIKey() {
    $headers = getallheaders();
    $apiKey = isset($headers['X-API-Key']) ? $headers['X-API-Key'] : 
              (isset($headers['x-api-key']) ? $headers['x-api-key'] : '');
    
    if ($apiKey !== API_KEY) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized: Invalid API key']);
        exit();
    }
}

// Send JSON response
function sendResponse($success, $data = null, $error = null, $code = 200) {
    http_response_code($code);
    $response = ['success' => $success];
    
    if ($data !== null) {
        $response['data'] = $data;
    }
    
    if ($error !== null) {
        $response['error'] = $error;
    }
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit();
}
?>
```

### Step 3: Create Invoice Sync Endpoint
**File: `public_html/api/mobile-sync/create-invoice.php`**

```php
<?php
define('API_ACCESS', true);
require_once 'config.php';

// Verify API key
verifyAPIKey();

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(false, null, 'Method not allowed', 405);
}

try {
    // Get JSON input
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        sendResponse(false, null, 'Invalid JSON data', 400);
    }
    
    // Validate required fields
    $requiredFields = ['customerName', 'customerPhone', 'carModel', 'totalPrice'];
    foreach ($requiredFields as $field) {
        if (!isset($data[$field]) || empty($data[$field])) {
            sendResponse(false, null, "Missing required field: $field", 400);
        }
    }
    
    // Get database connection
    $pdo = getDBConnection();
    
    // Prepare INSERT query
    // IMPORTANT: Adjust column names to match YOUR transfers table structure
    $sql = "INSERT INTO transfers (
        firebase_id,
        customer_name,
        customer_phone,
        car_model,
        total_price,
        services,
        photos_count,
        parts_count,
        status,
        created_at,
        updated_at
    ) VALUES (
        :firebase_id,
        :customer_name,
        :customer_phone,
        :car_model,
        :total_price,
        :services,
        :photos_count,
        :parts_count,
        :status,
        NOW(),
        NOW()
    )";
    
    $stmt = $pdo->prepare($sql);
    
    // Bind parameters
    $stmt->execute([
        ':firebase_id' => $data['firebaseId'] ?? null,
        ':customer_name' => $data['customerName'],
        ':customer_phone' => $data['customerPhone'],
        ':car_model' => $data['carModel'],
        ':total_price' => $data['totalPrice'],
        ':services' => isset($data['services']) ? json_encode($data['services']) : null,
        ':photos_count' => $data['photosCount'] ?? 0,
        ':parts_count' => $data['partsCount'] ?? 0,
        ':status' => $data['status'] ?? 'pending'
    ]);
    
    $insertId = $pdo->lastInsertId();
    
    // Log success
    error_log("Invoice synced successfully. ID: $insertId, Firebase ID: " . ($data['firebaseId'] ?? 'N/A'));
    
    sendResponse(true, [
        'id' => $insertId,
        'message' => 'Invoice synced successfully'
    ]);
    
} catch (PDOException $e) {
    error_log("Database error: " . $e->getMessage());
    sendResponse(false, null, 'Database error: ' . $e->getMessage(), 500);
} catch (Exception $e) {
    error_log("Error: " . $e->getMessage());
    sendResponse(false, null, $e->getMessage(), 500);
}
?>
```

### Step 4: Create Test Endpoint
**File: `public_html/api/mobile-sync/test.php`**

```php
<?php
define('API_ACCESS', true);
require_once 'config.php';

// Verify API key
verifyAPIKey();

try {
    $pdo = getDBConnection();
    
    // Test database connection
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM transfers");
    $result = $stmt->fetch();
    
    sendResponse(true, [
        'message' => 'API is working!',
        'database_connected' => true,
        'transfers_count' => $result['count'],
        'server_time' => date('Y-m-d H:i:s'),
        'timezone' => date_default_timezone_get()
    ]);
    
} catch (Exception $e) {
    sendResponse(false, null, 'Connection test failed: ' . $e->getMessage(), 500);
}
?>
```

---

## Part 3: React Native Integration

### Step 1: Create API Service
**File: `src/services/cpanelService.js`** (Will be created next)

### Step 2: Update Firebase Service
We'll modify the `createInspection` function to also sync to cPanel.

### Step 3: Add Environment Variables
Add to your `.env` file:
```
EXPO_PUBLIC_CPANEL_API_URL=https://yourdomain.com/api/mobile-sync
EXPO_PUBLIC_CPANEL_API_KEY=your-secret-api-key-here-change-this-12345
```

---

## Part 4: Security Considerations

1. **API Key**: Use a strong random string (at least 32 characters)
2. **HTTPS**: Always use HTTPS in production
3. **Input Validation**: Validate all inputs on server side
4. **SQL Injection**: Use prepared statements (already implemented)
5. **Rate Limiting**: Consider adding rate limiting in production
6. **Firewall**: Whitelist your app server IP if possible

---

## Part 5: Testing Checklist

- [ ] Database connection works
- [ ] API key authentication works
- [ ] Test endpoint returns success
- [ ] Invoice creation works
- [ ] Error handling works
- [ ] Firebase sync happens first
- [ ] cPanel sync happens second
- [ ] Failures don't block the app

---

## Part 6: Troubleshooting

### Common Issues:

1. **CORS Errors**: Add proper headers (already in config.php)
2. **Database Connection Failed**: Check credentials and host
3. **401 Unauthorized**: Verify API key matches
4. **500 Server Error**: Check PHP error logs in cPanel
5. **Column Not Found**: Adjust column names to match your table

### Where to Find Logs:
- cPanel: Error logs in File Manager or Metrics section
- React Native: Console logs and network inspector

---

## Next Steps:

1. **Share your database structure** (table columns, data types)
2. **Provide your domain URL** where the API will be hosted
3. **Generate a secure API key** (I can help with this)
4. I'll create the React Native service to connect everything

---

## Example: Complete Data Flow

```javascript
// User creates invoice in app
→ Save to Firebase (primary storage)
→ Get Firebase document ID
→ Send data to cPanel API with Firebase ID
→ cPanel stores in transfers table
→ Both systems are synced
```

**Important**: Firebase remains the primary database. cPanel is a secondary backup/integration point.
