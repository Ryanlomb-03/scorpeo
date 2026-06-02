-- Table to track API requests to SerpApi to help manage the 250/month limit
CREATE TABLE IF NOT EXISTS trend_fetches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geo VARCHAR(10) NOT NULL DEFAULT 'US',
  engine VARCHAR(100) NOT NULL DEFAULT 'google_trends_trending_now',
  status VARCHAR(50) DEFAULT 'Success',
  total_time_taken DECIMAL(10, 2),
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table to store the individual trending searches from the API
CREATE TABLE IF NOT EXISTS trending_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fetch_id UUID REFERENCES trend_fetches(id) ON DELETE CASCADE,
  query VARCHAR(255) NOT NULL,
  search_volume BIGINT,
  increase_percentage INT,
  active BOOLEAN DEFAULT TRUE,
  start_timestamp BIGINT,
  categories JSONB, -- Stores array of category objects e.g., [{"id": 11, "name": "Other"}]
  trend_breakdown JSONB, -- Stores array of related queries/breakdowns
  serpapi_google_trends_link TEXT,
  news_page_token TEXT,
  serpapi_news_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_trend_fetches_fetched_at ON trend_fetches(fetched_at);
CREATE INDEX IF NOT EXISTS idx_trending_searches_fetch_id ON trending_searches(fetch_id);
CREATE INDEX IF NOT EXISTS idx_trending_searches_query ON trending_searches(query);

-- Helper view to check how many requests we've made this month
CREATE OR REPLACE VIEW monthly_trend_fetches AS
SELECT 
    date_trunc('month', fetched_at) as month,
    COUNT(*) as total_requests
FROM trend_fetches
GROUP BY date_trunc('month', fetched_at)
ORDER BY month DESC;
