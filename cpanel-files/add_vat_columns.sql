-- Add VAT columns to transfers table
ALTER TABLE transfers
ADD COLUMN vat_enabled TINYINT(1) DEFAULT 0,
ADD COLUMN vat_amount DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN vat_rate DECIMAL(5,4) DEFAULT 0.0000,
ADD COLUMN subtotal_before_vat DECIMAL(10,2) DEFAULT 0.00;