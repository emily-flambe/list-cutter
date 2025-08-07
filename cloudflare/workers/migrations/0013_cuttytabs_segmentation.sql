-- Cuttytabs Segmentation MVP Database Schema
-- Creates tables for dynamic segmentation and incremental processing
-- Based on Spec 1.5 - Segmentation MVP

-- Store CSV data rows in D1 for querying and segmentation
CREATE TABLE IF NOT EXISTS csv_data (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON data for the row
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Index for fast incremental processing queries
CREATE INDEX IF NOT EXISTS idx_csv_timestamps ON csv_data(file_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_csv_created ON csv_data(created_at);

-- Store segment definitions and metadata
CREATE TABLE IF NOT EXISTS segments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  file_id TEXT NOT NULL,
  query TEXT NOT NULL, -- JSON segment query definition
  member_count INTEGER DEFAULT 0,
  last_processed DATETIME DEFAULT NULL,
  google_ads_enabled BOOLEAN DEFAULT FALSE,
  google_ads_customer_id TEXT DEFAULT NULL,
  google_ads_list_id TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT NOT NULL,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for processing segments by last processed time
CREATE INDEX IF NOT EXISTS idx_segments_processing ON segments(last_processed);
CREATE INDEX IF NOT EXISTS idx_segments_user ON segments(user_id);

-- Track segment membership for incremental updates
CREATE TABLE IF NOT EXISTS segment_members (
  segment_id TEXT,
  record_id TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (segment_id, record_id),
  FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE,
  FOREIGN KEY (record_id) REFERENCES csv_data(id) ON DELETE CASCADE
);

-- Index for fast membership queries
CREATE INDEX IF NOT EXISTS idx_members_segment ON segment_members(segment_id);

-- Queue for platform activation (Google Ads, etc.)
CREATE TABLE IF NOT EXISTS activation_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  segment_id TEXT NOT NULL,
  record_ids TEXT NOT NULL, -- JSON array of record IDs
  platform TEXT NOT NULL DEFAULT 'google_ads',
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME DEFAULT NULL,
  FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE
);

-- Index for processing activation queue
CREATE INDEX IF NOT EXISTS idx_activation_status ON activation_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_activation_segment ON activation_queue(segment_id);

-- Create a trigger to update updated_at on csv_data changes
CREATE TRIGGER IF NOT EXISTS csv_data_updated_at
  AFTER UPDATE ON csv_data
  FOR EACH ROW
  BEGIN
    UPDATE csv_data SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

-- Create a trigger to update updated_at on segments changes  
CREATE TRIGGER IF NOT EXISTS segments_updated_at
  AFTER UPDATE ON segments
  FOR EACH ROW
  BEGIN
    UPDATE segments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;