-- CUT Phase 1 Foundation - Filter Configurations
-- Ruby's RADICAL SIMPLICITY: Store user filter preferences and column metadata
-- Supports dynamic filtering based on data type detection

-- Store filter configurations for files
CREATE TABLE IF NOT EXISTS filter_configurations (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  column_name TEXT NOT NULL,
  data_type TEXT NOT NULL, -- integer, decimal, date, boolean, categorical, text
  filter_type TEXT NOT NULL, -- equals, range, contains, etc.
  filter_value TEXT NOT NULL, -- JSON-encoded filter parameters
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for fast filter queries
CREATE INDEX IF NOT EXISTS idx_filter_file_user ON filter_configurations(file_id, user_id);
CREATE INDEX IF NOT EXISTS idx_filter_column ON filter_configurations(column_name);
CREATE INDEX IF NOT EXISTS idx_filter_active ON filter_configurations(is_active);
CREATE INDEX IF NOT EXISTS idx_filter_type ON filter_configurations(data_type, filter_type);

-- Store column metadata cache for fast UI rendering
CREATE TABLE IF NOT EXISTS column_metadata_cache (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  column_name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  confidence REAL NOT NULL,
  unique_value_count INTEGER DEFAULT 0,
  null_count INTEGER DEFAULT 0,
  total_samples INTEGER DEFAULT 0,
  sample_values TEXT, -- JSON array of sample values
  filter_suggestions TEXT, -- JSON array of suggested filter types
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  UNIQUE(file_id, column_name)
);

-- Indexes for column metadata queries
CREATE INDEX IF NOT EXISTS idx_column_cache_file ON column_metadata_cache(file_id);
CREATE INDEX IF NOT EXISTS idx_column_cache_type ON column_metadata_cache(data_type);

-- Update triggers for timestamp maintenance
CREATE TRIGGER IF NOT EXISTS filter_configurations_updated_at
  AFTER UPDATE ON filter_configurations
  FOR EACH ROW
  BEGIN
    UPDATE filter_configurations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS column_metadata_cache_updated_at
  AFTER UPDATE ON column_metadata_cache
  FOR EACH ROW
  BEGIN
    UPDATE column_metadata_cache SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;