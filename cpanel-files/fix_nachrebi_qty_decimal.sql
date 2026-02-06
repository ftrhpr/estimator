-- Update nachrebi_qty column to support decimal values
-- Run this SQL in your cPanel phpMyAdmin to fix decimal truncation issue

-- Change column type from INT to DECIMAL(10,2) to support values like 2.5
ALTER TABLE transfers MODIFY COLUMN nachrebi_qty DECIMAL(10,2) NULL DEFAULT NULL;

-- Verify the column type was changed
SHOW COLUMNS FROM transfers LIKE 'nachrebi_qty';
