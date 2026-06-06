-- Message reactions table for storing user feedback on AI responses
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  reaction_type VARCHAR(10) NOT NULL CHECK (reaction_type IN ('like', 'dislike')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure a user can only have one reaction per message
  UNIQUE(message_id, user_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_type ON message_reactions(reaction_type);

-- Foreign key constraint to messages table (will be added after messages table is properly set up)
-- ALTER TABLE message_reactions ADD CONSTRAINT fk_message_reactions_message_id 
--   FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_reaction_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_message_reactions_updated_at ON message_reactions;
CREATE TRIGGER update_message_reactions_updated_at BEFORE UPDATE ON message_reactions
    FOR EACH ROW EXECUTE FUNCTION update_reaction_updated_at();

-- Helper view to get reaction counts per message
CREATE OR REPLACE VIEW message_reaction_stats AS
SELECT 
    message_id,
    COUNT(*) FILTER (WHERE reaction_type = 'like') as like_count,
    COUNT(*) FILTER (WHERE reaction_type = 'dislike') as dislike_count,
    COUNT(*) as total_reactions
FROM message_reactions
GROUP BY message_id;
