# cPanel PHP Files - Ready to Upload

## 📁 Files Generated:

1. **config.php** - Database configuration and API security
2. **create-invoice.php** - Invoice sync endpoint
3. **test.php** - Connection test endpoint

---

## 🚀 Upload Instructions:

### Step 1: Upload to cPanel

1. Login to your cPanel
2. Open **File Manager**
3. Navigate to `public_html/`
4. Create folder: `api/mobile-sync/`
5. Upload all 3 PHP files to: `public_html/api/mobile-sync/`

**Final structure:**
```
public_html/
└── api/
    └── mobile-sync/
        ├── config.php
        ├── create-invoice.php
        └── test.php
```

---

## ⚙️ Configuration:

### Step 2: Edit config.php

Open `config.php` and update these lines:

```php
define('DB_NAME', 'your_database_name');     // ← Your actual database name
define('DB_USER', 'your_database_user');      // ← Your database username
define('DB_PASS', 'your_database_password');  // ← Your database password
define('API_KEY', 'CHANGE-THIS-TO-RANDOM-KEY'); // ← Generate random 32+ char key
```

### Step 3: Generate API Key

Use one of these methods:

**Online:**
- Visit: https://www.random.org/strings/
- Settings: 1 string, 40 characters, alphanumeric

**Command line (Windows PowerShell):**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 40 | % {[char]$_})
```

**Example API key format:**
```
aB3dEf7gH1jKlM9nPqR4sTuV6wXyZ2aC5bD8eF0gH
```

### Step 4: Update .env in Your React Native Project

Add these lines to your `.env` file:

```bash
EXPO_PUBLIC_CPANEL_API_URL=https://yourdomain.com/api/mobile-sync
EXPO_PUBLIC_CPANEL_API_KEY=paste_your_generated_key_here
```

**Important:** Use the SAME API key in both `config.php` and `.env`!

---

## ✅ Testing:

### Step 5: Test the API

1. Restart your Expo app:
   ```bash
   npx expo start --clear
   ```

2. Navigate to test screen: `/admin/cpanel-test`

3. Click "Test Connection"

4. Expected result:
   ```json
   {
     "success": true,
     "message": "API is working!",
     "database_connected": true,
     "transfers_count": 0,
     "server_time": "2026-01-08 10:30:00"
   }
   ```

---

## 🗺️ Database Mapping:

Your mobile app data is mapped to your database as follows:

| Mobile App | → | Database Column |
|-----------|---|----------------|
| customerName | → | `name` |
| customerPhone | → | `phone` |
| carModel | → | `plate` |
| totalPrice | → | `amount` |
| parts[] | → | `parts` (JSON) |
| Firebase ID + metadata | → | `systemLogs` (JSON) |

---

## 📝 API Endpoints:

### Test Connection
```
GET https://yourdomain.com/api/mobile-sync/test.php
Headers: X-API-Key: your_key
```

### Create Invoice
```
POST https://yourdomain.com/api/mobile-sync/create-invoice.php
Headers: 
  Content-Type: application/json
  X-API-Key: your_key
Body: {
  "firebaseId": "abc123",
  "customerName": "John Doe",
  "customerPhone": "+995599123456",
  "carModel": "Toyota Camry",
  "totalPrice": 1500.50,
  "parts": [...],
  "services": [...],
  "photosCount": 5,
  "partsCount": 3
}
```

---

## 🔒 Security Checklist:

- [ ] Changed default database credentials
- [ ] Generated strong API key (40+ characters)
- [ ] API key is different in config.php and .env
- [ ] .env file is in .gitignore
- [ ] Using HTTPS (not HTTP)
- [ ] File permissions set to 644 (or as recommended by hosting)

---

## 🐛 Troubleshooting:

### "Database connection failed"
- Check database credentials in config.php
- Verify database exists in cPanel MySQL
- Check if database user has permissions

### "401 Unauthorized"
- API keys don't match
- Restart Expo app after changing .env
- Check header name is exactly: `X-API-Key`

### "Column not found"
- Verify your transfers table has these columns:
  - plate, name, phone, amount, status
  - parts, serviceDate, user_response
  - operatorComment, systemLogs

### "CORS error"
- Headers are already set in config.php
- Check if cPanel mod_security is blocking

---

## 📊 View Logs:

**PHP Error Logs:**
- cPanel → Metrics → Errors
- Or check: `public_html/error_log`

**App Logs:**
- Check React Native console
- Look for: `[cPanel API]` messages

---

## 🎯 What Happens When Invoice is Created:

1. User creates invoice in mobile app
2. Invoice saves to Firebase ✅ (always works)
3. App sends data to cPanel API 🚀
4. PHP validates API key and data
5. PHP inserts into transfers table
6. Response sent back to app
7. Success logged in console

**If cPanel fails:** App continues working with Firebase only!

---

## 📞 Need Help?

Check:
1. PHP error logs in cPanel
2. React Native console logs
3. Test endpoint response
4. Database user permissions

Share error messages for faster troubleshooting!
