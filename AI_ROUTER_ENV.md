# Scorpeo AI Router - Environment Variables

This document describes the environment variables required for the multi-provider AI routing system in Scorpeo.

## Required Environment Variables

### NVIDIA NIM
```bash
NVIDIA_API_KEY=your_nvidia_api_key_here
```
- **Purpose**: Access to NVIDIA NIM API for Llama models
- **Get it**: https://build.nvidia.com/
- **Priority**: 90 (High priority for general tasks)
- **Rate Limits**: 60 requests/minute, 1000 requests/day

### Groq
```bash
GROQ_API_KEY=your_groq_api_key_here
```
- **Purpose**: Access to Groq API for ultra-fast inference
- **Get it**: https://console.groq.com/keys
- **Priority**: 85 (High priority for fast response tasks)
- **Rate Limits**: 30 requests/minute, 1440 requests/day

### Cloudflare Workers AI
```bash
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id_here
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token_here
```
- **Purpose**: Access to Cloudflare Workers AI for edge inference
- **Get it**: https://dash.cloudflare.com/profile/api-tokens
- **Priority**: 70 (Medium priority)
- **Rate Limits**: 50 requests/minute, 10000 requests/day

### Mistral AI
```bash
MISTRAL_API_KEY=your_mistral_api_key_here
```
- **Purpose**: Access to Mistral AI API for coding and reasoning
- **Get it**: https://console.mistral.ai/api-keys
- **Priority**: 88 (High priority for coding tasks)
- **Rate Limits**: 20 requests/minute, 2000 requests/day

### OpenRouter
```bash
OPENROUTER_API_KEY=your_openrouter_api_key_here
```
- **Purpose**: Access to OpenRouter API for multi-model fallback
- **Get it**: https://openrouter.ai/keys
- **Priority**: 50 (Low priority as fallback)
- **Rate Limits**: 20 requests/minute, 200 requests/day

## Optional Environment Variables

### Supabase (Database)
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
DATABASE_URL=your_postgresql_connection_string
```
- **Purpose**: Database for conversation storage and message history
- **Get it**: https://supabase.com/dashboard

### Firebase (Optional - Currently Not Used)
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_firebase_measurement_id
```
- **Purpose**: Firebase integration (currently not used in the application)
- **Status**: Can be omitted if not using Firebase features

## Provider Priority System

The router uses a priority-based system to select the best provider for each task:

1. **NVIDIA (90)**: Best for general chat and coding
2. **Mistral (88)**: Best for coding and reasoning
3. **Groq (85)**: Best for fast response requirements
4. **Cloudflare (70)**: Good for edge computing and general tasks
5. **OpenRouter (50)**: Fallback provider with access to multiple models

## Task-Specific Routing

The router automatically selects providers based on task type:

- **Vision Tasks**: Compatible NVIDIA/Groq models → fallback
- **Fast Response**: Groq → NVIDIA → Cloudflare → Mistral → OpenRouter
- **Reasoning**: NVIDIA → Mistral → Groq → Cloudflare → OpenRouter
- **Coding**: NVIDIA → Mistral → Groq → Cloudflare → OpenRouter
- **General Chat**: NVIDIA → Groq → Mistral → Cloudflare → OpenRouter

## Rate Limit Handling

The router automatically handles rate limits by:

1. Tracking requests per minute and per day
2. Putting providers in cooldown when limits are reached
3. Automatically retrying with alternative providers
4. Exponential backoff with jitter for failed requests

## Cooldown Behavior

When a provider fails or hits rate limits:

1. Provider is marked as in cooldown
2. Router selects next best provider
3. Provider automatically recovers after cooldown period
4. Successful requests reset cooldown status

## Minimum Configuration

To get started with basic functionality, you need at least:

```bash
GROQ_API_KEY=your_groq_api_key
```

This provides fast, reliable chat capabilities with automatic fallback to other providers if you add their keys later.

## Security Notes

- Never commit `.env.local` or any environment variable files to version control
- Use different API keys for development and production
- Rotate API keys regularly
- Monitor API usage and costs
- Use environment-specific configurations (`.env.development`, `.env.production`)

## Troubleshooting

### Provider Not Available
If a provider shows as unavailable:
- Check that the API key is set correctly
- Verify the API key has not expired
- Check if the provider's API is operational

### Rate Limit Errors
If you see frequent rate limit errors:
- Add more provider API keys to distribute load
- Increase cooldown durations in provider configuration
- Consider upgrading your API plan

### High Latency
If response times are slow:
- Check provider health status
- Prioritize faster providers (Groq, Gemini)
- Consider geographic location of API endpoints
