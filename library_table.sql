-- Library table for storing user files
CREATE TABLE IF NOT EXISTS library (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  original_file_size BIGINT NOT NULL,
  file_data BYTEA NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_compressed BOOLEAN DEFAULT TRUE,
  compression_ratio DECIMAL(5, 2)
);

-- Create a separate table for file thumbnails (for images)
CREATE TABLE IF NOT EXISTS library_thumbnails (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id VARCHAR(36) NOT NULL,
  thumbnail_data BYTEA NOT NULL,
  thumbnail_width INT,
  thumbnail_height INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (library_id) REFERENCES library(id) ON DELETE CASCADE
);

-- Create trigger to auto-update modified_at timestamp
CREATE OR REPLACE FUNCTION update_modified_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.modified_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_library_modified_at ON library;
CREATE TRIGGER update_library_modified_at BEFORE UPDATE ON library
    FOR EACH ROW EXECUTE FUNCTION update_modified_at_column();
