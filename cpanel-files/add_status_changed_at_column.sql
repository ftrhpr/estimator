-- Add status_changed_at column to track when a case entered its current status (e.g. "In Service")
-- This is used to calculate "days in service" accurately instead of using created_at or updated_at.
-- Run this SQL on the cPanel MySQL database.

ALTER TABLE transfers ADD COLUMN status_changed_at TIMESTAMP NULL DEFAULT NULL AFTER status_id;
