# Quick Setup Guide - cPanel Integration

## What You Need to Provide:

### 1. Database Information
Please provide these details about your cPanel MySQL database:

```
Database Host: ___________________ (usually "localhost")
Database Name: ___________________
Database Username: ___________________
Database Password: ___________________
Database Port: ___________________ (usually 3306)
```

### 2. Table Structure
Run this SQL query in cPanel phpMyAdmin and share the results:

```sql
DESCRIBE transfers;
```

Or provide the column names and types from your transfers table.

### 3. Domain URL
What is your cPanel domain where the API will be hosted?

```
Example: https://yourdomain.com
Your domain: ___________________
```

---

## Quick Setup Steps:

### Step 1: Upload PHP Files to cPanel

1. Login to cPanel File Manager
2. Navigate to `public_html/`
3. Create folder: `api/mobile-sync/`
4. Upload these 3 files from your project root:
   - `config.php` (from CPANEL_INTEGRATION_GUIDE.md)
   - `create-invoice.php` (from CPANEL_INTEGRATION_GUIDE.md)
   - `test.php` (from CPANEL_INTEGRATION_GUIDE.md)

### Step 2: Edit config.php

Open `config.php` in cPanel File Manager and update:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'your_database_name');     // ← Change this
define('DB_USER', 'your_database_user');      // ← Change this
define('DB_PASS', 'your_database_password');  // ← Change this
define('API_KEY', 'GENERATE_RANDOM_KEY_HERE'); // ← Change this
```

### Step 3: Generate API Key

Generate a secure random API key. You can use:

**Option A - Online Generator:**
Visit: https://www.random.org/strings/
- Generate 1 string
- 40 characters long
- Letters and numbers

**Option B - Command Line:**
```bash
openssl rand -hex 32
```

**Option C - Python:**
```python
import secrets
print(secrets.token_urlsafe(32))
```

Copy the generated key and use it in both:
1. `config.php` (line with API_KEY)
2. `.env` file in your React Native project

### Step 4: Update .env File

Add these lines to your `.env` file:

```bash
# cPanel Integration
EXPO_PUBLIC_CPANEL_API_URL=https://yourdomain.com/api/mobile-sync
EXPO_PUBLIC_CPANEL_API_KEY=paste_your_generated_key_here
```

### Step 5: ✅ Database Already Configured!

**Good news!** The PHP code has been customized for your exact database structure.

The INSERT query now correctly maps:
- `customerName` → `name` column
- `customerPhone` → `phone` column  
- `carModel` → `plate` column
- `totalPrice` → `amount` column
- Firebase metadata → `systemLogs` JSON column
- Parts data → `parts` JSON column

**No manual adjustments needed!** Just upload the files and configure the credentials.

### Step 6: Test the Connection

1. Restart your Expo app:
   ```bash
   npx expo start --clear
   ```

2. Navigate to the test screen by adding a temporary button in your app:
   ```javascript
   // In app/(tabs)/index.tsx or any screen
   import { router } from 'expo-router';
   
   <Button onPress={() => router.push('/admin/cpanel-test')}>
     Test cPanel Connection
   </Button>
   ```

3. Click "Test Connection" button in the test screen

4. If successful, you'll see:
   - ✅ Connection Successful
   - Database record count
   - Server time

### Step 7: Test Invoice Sync

1. Create a new invoice in your app
2. Check the console logs for:
   ```
   ✅ Invoice saved to Firebase: [id]
   ✅ Invoice synced to cPanel: [id]
   ```
3. Verify in cPanel phpMyAdmin that the record was created in the `transfers` table

---

## Troubleshooting:

### Error: "Database connection failed"
- Check database credentials in `config.php`
- Verify database user has permissions
- Check if database exists

### Error: "401 Unauthorized"
- API key mismatch
- Check both `config.php` and `.env` have the same key
- Restart Expo app after changing `.env`

### Error: "Column not found"
- Column names in `create-invoice.php` don't match your table
- Run `DESCRIBE transfers;` to see your actual columns
- Update the INSERT query accordingly

### Error: "CORS error"
- Headers are already set in `config.php`
- Check if cPanel has mod_security blocking requests
- Try disabling mod_security for the API folder

### No error but no data
- Check PHP error logs in cPanel
- Add `error_log()` statements in PHP files
- Check if API_KEY validation is working

---

## Database Column Mapping (CONFIGURED ✅)

Your actual database structure has been mapped:

| Mobile App Field | Database Column | Notes |
|-----------------|-----------------|-------|
| firebaseId | systemLogs (JSON) | Stored in JSON with metadata |
| customerName | name | Direct mapping |
| customerPhone | phone | Direct mapping |
| carModel | plate | Car plate/model number |
| totalPrice | amount | Decimal(10,2) |
| services | systemLogs (JSON) | Stored in JSON array |
| parts | parts (JSON) | Direct JSON column |
| photosCount | systemLogs (JSON) | Stored in JSON metadata |
| partsCount | systemLogs (JSON) | Stored in JSON metadata |
| status | status | Default: "New" |
| createdAt | created_at | Auto-generated timestamp |
| serviceDate | serviceDate | When service is scheduled |

**Additional fields set automatically:**
- `user_response` → "Pending"
- `operatorComment` → "Created from mobile app - Firebase ID: [id]"
- `systemLogs` → JSON with full metadata

**No changes needed** - The code is already configured for your database!

---

## Security Checklist:

- [ ] Generated strong API key (40+ characters)
- [ ] Changed default database credentials
- [ ] API key is NOT committed to git
- [ ] .env file is in .gitignore
- [ ] Using HTTPS (not HTTP) in production
- [ ] Database user has minimum required permissions
- [ ] PHP error display disabled in production

---

## Next Steps After Setup:

1. Test single invoice creation
2. Test batch sync of existing invoices
3. Monitor PHP error logs for issues
4. Set up regular backups of both Firebase and MySQL
5. Consider adding webhooks for bidirectional sync (optional)

---

## Need Help?

Share with me:
1. Results from `DESCRIBE transfers;`
2. Your domain URL
3. Any error messages from console or PHP logs
4. Screenshot of the test connection result
