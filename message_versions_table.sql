-- Message Versions Table for storing alternative AI responses
CREATE TABLE IF NOT EXISTS message_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR(36) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id VARCHAR(36) NOT NULL,
  version_number INT NOT NULL,
  content TEXT NOT NULL,
  retry_count INT DEFAULT 0,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  top_p DECIMAL(3,2) DEFAULT 0.95,
  model_id VARCHAR(50) REFERENCES models(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure unique version numbers per message
  UNIQUE(message_id, version_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_message_versions_message_id ON message_versions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_versions_conversation_id ON message_versions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_versions_version ON message_versions(version_number);
CREATE INDEX IF NOT EXISTS idx_message_versions_created_at ON message_versions(created_at DESC);

-- Function to get message with version navigation
CREATE OR REPLACE FUNCTION get_message_with_versions(p_message_id VARCHAR)
RETURNS TABLE (
  id VARCHAR,
  content TEXT,
  total_versions INT,
  current_version INT,
  all_versions JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    COALESCE(
      (
        SELECT mv.content 
        FROM message_versions mv 
        WHERE mv.message_id = m.id 
        ORDER BY mv.version_number DESC 
        LIMIT 1
      ),
      m.content
    ) as content,
    COALESCE(
      (SELECT COUNT(*) FROM message_versions mv WHERE mv.message_id = m.id) + 1,
      1
    ) as total_versions,
    COALESCE(
      (SELECT MAX(mv.version_number) FROM message_versions mv WHERE mv.message_id = m.id) + 1,
      1
    ) as current_version,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'version', mv.version_number,
            'content', mv.content,
            'created_at', mv.created_at,
            'model_id', mv.model_id
          )
          ORDER BY mv.version_number DESC
        )
        FROM message_versions mv
        WHERE mv.message_id = m.id
      ),
      jsonb_build_object(
        'version', 1,
        'content', m.content,
        'created_at', m.created_at,
        'model_id', NULL
      )::jsonb
    ) as all_versions
  FROM messages m
  WHERE m.id = p_message_id;
END;
$$ LANGUAGE plpgsql;

-- Function to add a new message version
CREATE OR REPLACE FUNCTION add_message_version(
  p_message_id VARCHAR,
  p_content TEXT,
  p_model_id VARCHAR DEFAULT NULL,
  p_temperature DECIMAL DEFAULT 0.7,
  p_top_p DECIMAL DEFAULT 0.95
) RETURNS INT AS $$
DECLARE
  v_new_version INT;
BEGIN
  -- Get the current highest version number
  SELECT COALESCE(MAX(mv.version_number), 0) + 1 INTO v_new_version
  FROM message_versions mv
  WHERE mv.message_id = p_message_id;
  
  -- Insert the new version
  INSERT INTO message_versions (
    message_id,
    conversation_id,
    version_number,
    content,
    retry_count,
    temperature,
    top_p,
    model_id
  )
  SELECT
    p_message_id,
    m.conversation_id,
    v_new_version,
    p_content,
    (SELECT COUNT(*) FROM message_versions mv WHERE mv.message_id = p_message_id),
    p_temperature,
    p_top_p,
    p_model_id
  FROM messages m
  WHERE m.id = p_message_id;
  
  RETURN v_new_version;
END;
$$ LANGUAGE plpgsql;