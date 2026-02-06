-- Add updated_at column to transfers table
-- Run this SQL in your cPanel phpMyAdmin to fix missing completed cases issue

-- Check if column exists, add if not
SET @dbname = DATABASE();
SET @tablename = 'transfers';
SET @columnname = 'updated_at';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
    AND TABLE_NAME = @tablename
    AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT 1 -- Column already exists',
  'ALTER TABLE transfers ADD COLUMN updated_at TIMESTAMP NULL DEFAULT NULL'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Alternative simple version (run manually if above doesn't work):
-- ALTER TABLE transfers ADD COLUMN updated_at TIMESTAMP NULL DEFAULT NULL;

-- Update existing records to have updated_at = created_at where null
UPDATE transfers SET updated_at = created_at WHERE updated_at IS NULL AND created_at IS NOT NULL;

-- Verify the column was added
SHOW COLUMNS FROM transfers LIKE 'updated_at';
