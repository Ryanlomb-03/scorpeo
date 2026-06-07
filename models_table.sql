-- Model Registry Table
CREATE TABLE IF NOT EXISTS models (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  endpoint TEXT NOT NULL,
  api_key_param VARCHAR(50),
  priority INT DEFAULT 50,
  
  -- Capability Scores (0-100)
  speed_score INT DEFAULT 50,
  coding_score INT DEFAULT 50,
  math_score INT DEFAULT 50,
  reasoning_score INT DEFAULT 50,
  creative_score INT DEFAULT 50,
  
  -- Health Metrics
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'degraded', 'offline', 'disabled')),
  average_latency INT DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 100.00,
  total_requests INT DEFAULT 0,
  successful_requests INT DEFAULT 0,
  failed_requests INT DEFAULT 0,
  timeout_count INT DEFAULT 0,
  
  -- Routing Configuration
  roles TEXT[] DEFAULT ARRAY['chat'], -- 'chat', 'coding', 'math', 'reasoning', 'creative'
  enabled BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_checked TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP WITH TIME ZONE
);

-- Cache Table
CREATE TABLE IF NOT EXISTS cached_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hash VARCHAR(64) NOT NULL UNIQUE,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  model_id VARCHAR(50) REFERENCES models(id),
  intent_type VARCHAR(50),
  hits INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Model Health Log
CREATE TABLE IF NOT EXISTS model_health_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id VARCHAR(50) REFERENCES models(id) ON DELETE CASCADE,
  latency INT,
  success BOOLEAN,
  error_type VARCHAR(50), -- 'timeout', '429', '500', 'parse_error', 'other'
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_models_enabled ON models(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_models_roles ON models USING GIN(roles);
CREATE INDEX IF NOT EXISTS idx_models_status ON models(status);
CREATE INDEX IF NOT EXISTS idx_models_priority ON models(priority) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_cache_hash ON cached_responses(hash);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cached_responses(expires_at) WHERE expires_at > CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_health_model_id ON model_health_log(model_id);
CREATE INDEX IF NOT EXISTS idx_health_timestamp ON model_health_log(timestamp DESC);

-- Function to update model health
CREATE OR REPLACE FUNCTION update_model_health(
  p_model_id VARCHAR,
  p_latency INT,
  p_success BOOLEAN,
  p_error_type VARCHAR DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- Log the request
  INSERT INTO model_health_log (model_id, latency, success, error_type)
  VALUES (p_model_id, p_latency, p_success, p_error_type);
  
  -- Update model metrics
  UPDATE models SET
    total_requests = total_requests + 1,
    successful_requests = successful_requests + CASE WHEN p_success THEN 1 ELSE 0 END,
    failed_requests = failed_requests + CASE WHEN NOT p_success THEN 1 ELSE 0 END,
    timeout_count = timeout_count + CASE WHEN p_error_type = 'timeout' THEN 1 ELSE 0 END,
    average_latency = (average_latency * (total_requests - 1) + p_latency) / total_requests,
    success_rate = (successful_requests + CASE WHEN p_success THEN 1 ELSE 0 END)::DECIMAL / NULLIF(total_requests + 1, 0) * 100,
    last_checked = CURRENT_TIMESTAMP,
    last_used = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_model_id;
  
  -- Auto-adjust status based on health
  UPDATE models SET
    status = CASE
      WHEN success_rate < 50.0 THEN 'degraded'
      WHEN success_rate < 70.0 THEN 'degraded'
      WHEN timeout_count > 5 AND total_requests > 10 THEN 'degraded'
      WHEN success_rate >= 85.0 THEN 'active'
      ELSE status
    END
  WHERE id = p_model_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get best model for intent
CREATE OR REPLACE FUNCTION get_best_model(p_intent VARCHAR, p_roles TEXT[])
RETURNS TABLE (
  model_id VARCHAR,
  model_name VARCHAR,
  endpoint TEXT,
  api_key_param VARCHAR,
  priority INT,
  health_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.name,
    m.endpoint,
    m.api_key_param,
    m.priority,
    (
      -- Calculate health score: 0.35 * speed + 0.30 * availability + 0.20 * domain + 0.15 * success_rate
      (m.speed_score * 0.35) +
      (m.success_rate * 0.30) +
      (CASE 
        WHEN p_roles = ANY(m.roles) THEN m.speed_score * 0.20
        ELSE 0
      END) +
      (m.success_rate * 0.15)
    ) as health_score
  FROM models m
  WHERE m.enabled = true
    AND m.status = 'active'
    AND p_roles = ANY(m.roles)
  ORDER BY 
    health_score DESC,
    m.average_latency ASC,
    m.priority DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Insert initial NVIDIA models
INSERT INTO models (id, name, provider, endpoint, api_key_param, priority, speed_score, coding_score, math_score, reasoning_score, creative_score, roles) VALUES
  ('nim-minimax', 'MiniMax', 'NVIDIA', 'https://integrate.api.nvidia.com/v1/chat/completions', 'NVIDIA_API_KEY', 100, 95, 75, 80, 70, 65, ARRAY['chat', 'creative']),
  ('nim-qwen', 'Qwen Instruct', 'NVIDIA', 'https://integrate.api.nvidia.com/v1/chat/completions', 'NVIDIA_API_KEY', 95, 90, 92, 91, 85, 80, ARRAY['chat', 'coding', 'math']),
  ('nim-llama', 'Llama 3.x', 'NVIDIA', 'https://integrate.api.nvidia.com/v1/chat/completions', 'NVIDIA_API_KEY', 90, 85, 80, 85, 75, 85, ARRAY['chat', 'creative']),
  ('nim-deepseek', 'DeepSeek', 'NVIDIA', 'https://integrate.api.nvidia.com/v1/chat/completions', 'NVIDIA_API_KEY', 98, 80, 97, 96, 95, 70, ARRAY['coding', 'math', 'reasoning'])
ON CONFLICT (id) DO NOTHING;

-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_models_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_models_updated_at ON models;
CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON models
    FOR EACH ROW EXECUTE FUNCTION update_models_timestamp();
