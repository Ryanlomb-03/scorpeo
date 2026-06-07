# Scorpio AI Router - Phase 1 Implementation

## Overview

Scorpio has evolved from a single-model AI chat application to a sophisticated AI Orchestrator/Router system that automatically selects the best model based on intent, health, and performance metrics.

## Architecture

```
User Request
    │
    ▼
Intent Classifier
    │
    ├── Rule-based (greetings, keywords)
    ├── Keyword routing (coding, math, research)
    └── AI classification (fallback)
    │
    ▼
Model Router
    │
    ├── Check Cache (Supabase)
    ├── Select Best Model (health + latency + capability)
    └── Get API Key
    │
    ▼
Selected Model
    │
    ├── API Call with Streaming
    ├── Health Update (latency, success rate)
    └── Cache Response (for simple queries)
    │
    ▼
Stream Response to User
```

## Components Implemented

### 1. Model Registry Database (`models_table.sql`)

**Tables:**
- `models` - Stores model configurations and health metrics
- `cached_responses` - Caches common responses for speed
- `model_health_log` - Tracks individual request health data

**Model Registry Fields:**
- `id`, `name`, `provider`, `endpoint`
- Capability scores: `speed_score`, `coding_score`, `math_score`, `reasoning_score`, `creative_score`
- Health metrics: `status`, `average_latency`, `success_rate`, `total_requests`
- Routing: `roles`, `priority`, `enabled`

### 2. Intent Classifier (`lib/intentClassifier.ts`)

**Classification Types:**
- `greeting` - Simple hellos, thanks
- `chat` - General conversation
- `coding` - Programming questions
- `math` - Mathematical/physics questions
- `research` - Deep research requests
- `creative` - Creative writing tasks

**Hybrid Approach:**
- Rule-based for common patterns (fast, no AI needed)
- Keyword-based routing (React, Python, equation)
- Fallback to AI classification if confidence is low

**Complexity Scoring:**
- Calculates complexity (1-10) based on length, technical terms, question type
- Used to determine model parameters and caching strategy

### 3. Model Router (`lib/modelRouter.ts`)

**Routing Logic:**
1. Check cache first for common queries
2. Classify user intent
3. Select best available model based on:
   - Health score (35% weight)
   - Success rate (30% weight)
   - Domain capability (20% weight)
   - Recent success (15% weight)
4. Get API key for selected model
5. Stream response with health monitoring

**Health Monitoring:**
- Tracks latency per request
- Updates success/failure rates
- Auto-deprioritizes unhealthy models
- Automatic status adjustment (active → degraded → offline)

### 4. Updated Chat API (`app/api/chat/route.ts`)

**New Features:**
- Uses model router instead of hardcoded model
- Cache-first approach for simple queries
- Health tracking for all API calls
- Automatic fallback on model failure
- Dynamic parameter adjustment based on intent
- Response headers showing model used and intent type

### 5. Admin Dashboard (`app/admin/page.tsx`)

**Features:**
- Real-time model health monitoring
- Enable/disable models dynamically
- View latency, success rates, capability scores
- Automatic 30-second refresh
- Visual health score calculation

## Setup Instructions

### 1. Create Database Tables

Run the SQL script in your Supabase SQL Editor:

```bash
# Copy the contents of models_table.sql
# Run in Supabase SQL Editor
```

### 2. Update Environment Variables

No changes needed if you have:
- `NVIDIA_API_KEY` - Used as default
- Existing Supabase credentials

### 3. Test the System

```bash
# Start the development server
npm run dev

# Visit admin dashboard
http://localhost:3000/admin

# Try different query types:
# Greeting: "Hi"
# Coding: "Write a React function"
# Math: "Explain Einstein field equations"
# Research: "What is machine learning?"
```

## Model Configuration

### Initial Models (pre-configured):

1. **nim-minimax** - Fast, good for general chat
2. **nim-qwen** - Excellent for coding and math
3. **nim-llama** - Good for creative tasks
4. **nim-deepseek** - Best for reasoning and math

### Adding New Models:

Insert into the `models` table:

```sql
INSERT INTO models (
  id, name, provider, endpoint, api_key_param, priority,
  speed_score, coding_score, math_score, reasoning_score, creative_score,
  roles, enabled
) VALUES (
  'new-model-id',
  'Model Name',
  'Provider',
  'https://api.endpoint.com/v1/chat/completions',
  'YOUR_API_KEY_ENV_VAR',
  90,
  85, 90, 95, 80, 70,
  ARRAY['chat', 'coding'],
  true
);
```

### Model Capability Scoring (0-100):

- `speed_score` - How fast the model responds
- `coding_score` - Code generation quality
- `math_score` - Mathematical reasoning ability
- `reasoning_score` - Deep thinking capability
- `creative_score` - Creative writing ability

## Intent-Based Routing

### Greeting Queries (Fastest)
- Examples: "Hi", "Hello", "Thanks"
- Target latency: < 500ms
- Model: Fastest available with 'chat' role
- Parameters: Low temperature, low max_tokens

### Coding Queries
- Examples: "Write React function", "Fix Python bug"
- Keywords: React, TypeScript, function, bug, error
- Model: Highest coding_score with 'coding' role
- Parameters: Low temperature, high max_tokens

### Math/Physics Queries
- Examples: "Solve equation", "Explain relativity"
- Keywords: equation, tensor, proof, Einstein
- Model: Highest math_score with 'math' role
- Parameters: Very low temperature, high max_tokens

### Research Queries
- Examples: "Research topic", "Deep dive into..."
- Keywords: research, analyze, investigate, study
- Model: Highest reasoning_score with 'reasoning' role
- Parameters: Low temperature, very high max_tokens

### Creative Queries
- Examples: "Write story", "Create poem"
- Keywords: story, poem, creative, write
- Model: Highest creative_score with 'creative' role
- Parameters: High temperature, high max_tokens

## Caching Strategy

### Cached Query Types:
- Greetings (Hi, Hello, etc.)
- Simple questions (What is AI?, What is HTML?)
- Basic math (2+2, simple calculations)
- Common definitions

### Cache Duration: 24 hours

### Cache Benefits:
- Response time: 50ms (instead of several seconds)
- Reduced API costs
- Better user experience for common queries

## Health Monitoring

### Automatic Health Updates:
Every request updates:
- Average latency (moving average)
- Success rate percentage
- Timeout count
- Last checked timestamp

### Status Transitions:
- `active` → `degraded`: Success rate < 70% or timeout issues
- `degraded` → `active`: Success rate ≥ 85%
- `active` → `offline`: Severe issues (manual intervention)

### Manual Override:
Use admin dashboard to enable/disable models manually

## Performance Improvements

### Expected Performance Gains:
1. **Speed**: 50ms for cached queries vs 2-5s typical
2. **Reliability**: Automatic failover to healthy models
3. **Intelligence**: Better model selection per query type
4. **Cost**: Caching reduces API calls for common queries
5. **Monitoring**: Real-time health insights

## Future Phases

### Phase 2 - Performance:
- Model Racing (send to multiple models, use first response)
- Progressive streaming (show progress during deep reasoning)
- Redis integration for faster caching

### Phase 3 - Advanced:
- Coding pipeline (planner → coder → validator)
- Learning router (track which models work best for which queries)
- Streaming code with real-time syntax highlighting
- Vision model integration

## Monitoring and Debugging

### Check Model Health:
```bash
# Visit admin dashboard
http://localhost:3000/admin

# Or query API directly
curl http://localhost:3000/api/models
```

### View Response Headers:
```bash
# Check which model was used
curl -I http://localhost:3000/api/chat

# Headers to look for:
# X-Model: nim-qwen
# X-Intent: coding
# X-Cached: true (if cached)
# X-Fallback: true (if fallback used)
```

### Database Queries:
```sql
-- Check model health
SELECT * FROM models ORDER BY priority DESC;

-- View recent health logs
SELECT * FROM model_health_log 
ORDER BY timestamp DESC 
LIMIT 100;

-- Check cache statistics
SELECT COUNT(*) as total_cached, AVG(hits) as avg_hits
FROM cached_responses;
```

## Troubleshooting

### Models not appearing in admin dashboard:
1. Ensure tables were created from `models_table.sql`
2. Check Supabase connection in `.env.local`
3. Verify database permissions

### Health scores not updating:
1. Check if API calls are reaching the health update function
2. Verify Supabase function permissions
3. Check console logs for errors

### Cache not working:
1. Ensure `cached_responses` table exists
2. Check if cache query is finding results
3. Verify hash generation is working

### Intent classification seems wrong:
1. Check keyword lists in `intentClassifier.ts`
2. Adjust complexity scoring thresholds
3. Add more rule-based patterns

## Notes

- Current implementation uses NVIDIA models exclusively
- Future phases can add OpenAI, Anthropic, Google models
- The architecture is provider-agnostic and can handle any API
- All health data is persisted for analysis and learning
- The system learns from usage patterns over time

## Success Metrics

- **Speed**: Cached queries < 100ms
- **Reliability**: 99%+ successful responses
- **Intelligence**: Better model selection per query type
- **Monitoring**: Real-time health visibility
- **Flexibility**: Easy to add/remove models

This implementation provides the foundation for a production-grade AI system that can scale, adapt, and learn over time.