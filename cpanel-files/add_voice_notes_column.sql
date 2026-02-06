-- Add voiceNotes column to transfers table for storing voice recordings
-- This column stores JSON array of voice note objects with url, timestamp, authorName, duration

ALTER TABLE transfers 
ADD COLUMN voiceNotes TEXT NULL AFTER internalNotes;

-- Example of voiceNotes data structure:
-- [{"url": "https://firebase-storage-url...", "timestamp": "2026-02-02T12:00:00Z", "authorName": "მობილური აპი", "duration": 30}]
