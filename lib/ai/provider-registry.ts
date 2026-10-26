// Provider Capability Registry
// Central registry for all provider/model metadata, capabilities, and health state

export type StreamingProtocol = 'openai_sse' | 'gemini' | 'cloudflare' | 'mistral' | 'nvidia' | 'openrouter';

export type ModelCapability = 'chat' | 'streaming' | 'image_generation' | 'vision' | 'tools' | 'embeddings';

export type ErrorType = 'AUTHENTICATION_ERROR' | 'INVALID_MODEL' | 'INVALID_REQUEST' | 'RATE_LIMITED' | 'SERVICE_UNAVAILABLE' | 'TIMEOUT' | 'NETWORK_ERROR' | 'STREAM_ERROR' | 'PROVIDER_ERROR' | 'UNKNOWN_ERROR';

export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  cooldownUntil?: Date;
  lastSuccess?: Date;
  lastFailure?: Date;
  failureType?: ErrorType;
  consecutiveFailures: number;
  averageLatency?: number;
  averageTTFB?: number;
}

export interface ModelMetadata {
  provider: string;
  modelId: string;
  displayName: string;
  capabilities: Record<ModelCapability, boolean>;
  protocol: StreamingProtocol;
  priority: number;
  contextWindow: number;
  maxTokens: number;
  pricingTier: 'free' | 'paid';
  roles: string[];
  health: ProviderHealth;
}

// Provider capability registry
export const PROVIDER_REGISTRY: Record<string, ModelMetadata[]> = {
  nvidia: [
    {
      provider: 'nvidia',
      modelId: 'deepseek-ai/deepseek-v4-pro-0813',
      displayName: 'DeepSeek V4 Pro',
      capabilities: {
        chat: true,
        streaming: true,
        image_generation: false,
        vision: false,
        tools: true,
        embeddings: false,
      },
      protocol: 'nvidia',
      priority: 90,
      contextWindow: 128000,
      maxTokens: 4096,
      pricingTier: 'paid',
      roles: ['reasoning', 'coding', 'math'],
      health: {
        status: 'unknown',
        consecutiveFailures: 0,
      },
    },
    {
      provider: 'nvidia',
      modelId: 'moonshotai/kimi-k3',
      displayName: 'Kimi K3',
      capabilities: {
        chat: true,
        streaming: true,
        image_generation: false,
        vision: false,
        tools: true,
        embeddings: false,
      },
      protocol: 'nvidia',
      priority: 85,
      contextWindow: 128000,
      maxTokens: 4096,
      pricingTier: 'paid',
      roles: ['general', 'reasoning'],
      health: {
        status: 'unknown',
        consecutiveFailures: 0,
      },
    },
    {
      provider: 'nvidia',
      modelId: 'openai/gpt-oss-20b',
      displayName: 'GPT OSS 20B',
      capabilities: {
        chat: true,
        streaming: true,
        image_generation: false,
        vision: false,
        tools: true,
        embeddings: false,
      },
      protocol: 'nvidia',
      priority: 80,
      contextWindow: 128000,
      maxTokens: 4096,
      pricingTier: 'paid',
      roles: ['general', 'coding'],
      health: {
        status: 'unknown',
        consecutiveFailures: 0,
      },
    },
  ],
  groq: [
    {
      provider: 'groq',
      modelId: 'meta-llama/llama-prompt-guard-2-22m',
      displayName: 'LLaMA Prompt Guard',
      capabilities: {
        chat: false, // Text classification only
        streaming: false, // Does not support streaming
        image_generation: false,
        vision: false,
        tools: false,
        embeddings: false,
      },
      protocol: 'openai_sse',
      priority: 10,
      contextWindow: 4096,
      maxTokens: 100,
      pricingTier: 'free',
      roles: ['classification', 'safety'],
      health: {
        status: 'unknown',
        consecutiveFailures: 0,
      },
    },
    {
      provider: 'groq',
      modelId: 'qwen/qwen3.6-27b',
      displayName: 'Qwen 3.6 27B',
      capabilities: {
        chat: true,
        streaming: true,
        image_generation: false,
        vision: false,
        tools: true,
        embeddings: false,
      },
      protocol: 'openai_sse',
      priority: 88,
      contextWindow: 32768,
      maxTokens: 8192,
      pricingTier: 'free',
      roles: ['general', 'coding', 'reasoning'],
      health: {
        status: 'unknown',
        consecutiveFailures: 0,
      },
    },
    {
      provider: 'groq',
      modelId: 'openai/gpt-oss-120b',
      displayName: 'GPT OSS 120B',
      capabilities: {
        chat: true,
        streaming: true,
        image_generation: false,
        vision: false,
        tools: true,
        embeddings: false,
      },
      protocol: 'openai_sse',
      priority: 92,
      contextWindow: 32768,
      maxTokens: 8192,
      pricingTier: 'free',
      roles: ['reasoning', 'coding', 'general'],
      health: {
        status: 'unknown',
        consecutiveFailures: 0,
      },
    },
  ],
  cloudflare: [
    {
      provider: 'cloudflare',
      modelId: 'anthropic/claude-fable-5.1',
      displayName: 'Claude Fable 5.1',
      capabilities: {
        chat: true,
        streaming: true,
        image_generation: false,
        vision: false,
        tools: true,
        embeddings: false,
      },
      protocol: 'cloudflare',
      priority: 87,
      contextWindow: 200000,
      maxTokens: 8192,
      pricingTier: 'paid',
      roles: ['general', 'reasoning', 'coding'],
      health: {
        status: 'unknown',
        consecutiveFailures: 0,
      },
    },
    {
      provider: 'cloudflare',
      modelId: 'xai/grok-imagine-image-2.0',
      displayName: 'Grok Imagine Image',
      capabilities: {
        chat: false, // Image generation only
        streaming: false,
        image_generation: true,
        vision: false,
        tools: false,
        embeddings: false,
      },
      protocol: 'cloudflare',
      priority: 70,
      contextWindow: 0,
      maxTokens: 0,
      pricingTier: 'paid',
      roles: ['image_generation'],
      health: {
        status: 'unknown',
        consecutiveFailures: 0,
      },
    },
    {
      provider: 'cloudflare',
      modelId: 'xai/grok-4.6',
      displayName: 'Grok 4.6',
      capabilities: {
        chat: true,
        streaming: true,
        image_generation: false,
        vision: false,
        tools: true,
        embeddings: false,
      },
      protocol: 'cloudflare',
      priority: 89,
      contextWindow: 128000,
      maxTokens: 8192,
      pricingTier: 'paid',
      roles: ['general', 'reasoning'],
      health: {
        status: 'unknown',
        consecutiveFailures: 0,
      },
    },
    {
      provider: 'cloudflare',
      modelId: 'alibaba/qwen3.7-max',
      displayName: 'Qwen 3.7 Max',
      capabilities: {
        chat: true,
        streaming: true,
        image_generation: false,
        vision: false,
        tools: true,
        embeddings: false,
      },
      protocol: 'cloudflare',
      priority: 86,
      contextWindow: 32768,
      maxTokens: 8192,
      pricingTier: 'paid',
      roles: ['general', 'coding', 'reasoning'],
      health: {
        status: 'unknown',
        consecutiveFailures: 0,
      },
    },
  ],
  gemini: [
    {
      provider: 'gemini',
      modelId: 'gemini-3.8-flash',
      displayName: 'Gemini 3.8 Flash',
      capabilities: {
        chat: true,
        streaming: true,
        image_generation: false,
        vision: true,
        tools: true,
        embeddings: false,
      },
      protocol: 'gemini',
      priority: 93,
      contextWindow: 1000000,
      maxTokens: 8192,
      pricingTier: 'paid',
      roles: ['fast', 'general', 'vision', 'reasoning'],
      health: {
        status: 'unknown',
        consecutiveFailures: 0,
      },
    },
    {
      provider: 'gemini',
      modelId: 'gemini-3.5-flash-lite',
      displayName: 'Gemini 3.5 Flash Lite',
      capabilities: {
        chat: true,
        streaming: true,
        image_generation: false,
        vision: false,
        tools: true,
        embeddings: false,
      },
      protocol: 'gemini',
      priority: 81,
      contextWindow: 32768,
      maxTokens: 4096,
      pricingTier: 'paid',
      roles: ['fast', 'classification', 'summarization'],
      health: {
        status: 'unknown',
        consecutiveFailures: 0,
      },
    },
    {
      provider: 'gemini',
      modelId: 'gemini-3.1-pro-preview',
      displayName: 'Gemini 3.1 Pro Preview',
      capabilities: {
        chat: true,
        streaming: true,
        image_generation: false,
        vision: true,
        tools: true,
        embeddings: false,
      },
      protocol: 'gemini',
      priority: 95,
      contextWindow: 2000000,
      maxTokens: 8192,
      pricingTier: 'paid',
      roles: ['reasoning', 'coding', 'vision', 'research'],
      health: {
        status: 'unknown',
        consecutiveFailures: 0,
      },
    },
  ],
  mistral: [
    {
      provider: 'mistral',
      modelId: 'mistral-large-latest',
      displayName: 'Mistral Large',
      capabilities: {
        chat: true,
        streaming: true,
        image_generation: false,
        vision: false,
        tools: true,
        embeddings: false,
      },
      protocol: 'mistral',
      priority: 91,
      contextWindow: 128000,
      maxTokens: 8192,
      pricingTier: 'paid',
      roles: ['reasoning', 'coding', 'general'],
      health: {
        status: 'unknown',
        consecutiveFailures: 0,
      },
    },
    {
      provider: 'mistral',
      modelId: 'mistral-small-latest',
      displayName: 'Mistral Small',
      capabilities: {
        chat: true,
        streaming: true,
        image_generation: false,
        vision: false,
        tools: true,
        embeddings: false,
      },
      protocol: 'mistral',
      priority: 77,
      contextWindow: 32768,
      maxTokens: 8192,
      pricingTier: 'paid',
      roles: ['fast', 'general', 'summarization'],
      health: {
        status: 'unknown',
        consecutiveFailures: 0,
      },
    },
    {
      provider: 'mistral',
      modelId: 'codestral-latest',
      displayName: 'Codestral',
      capabilities: {
        chat: true,
        streaming: true,
        image_generation: false,
        vision: false,
        tools: true,
        embeddings: false,
      },
      protocol: 'mistral',
      priority: 83,
      contextWindow: 32768,
      maxTokens: 8192,
      pricingTier: 'paid',
      roles: ['coding'],
      health: {
        status: 'unknown',
        consecutiveFailures: 0,
      },
    },
  ],
  openrouter: [
    {
      provider: 'openrouter',
      modelId: 'minimax/minimax-m3:free',
      displayName: 'MiniMax M3 (Free)',
      capabilities: {
        chat: true,
        streaming: true,
        image_generation: false,
        vision: true,
        tools: true,
        embeddings: false,
      },
      protocol: 'openrouter',
      priority: 73,
      contextWindow: 200000,
      maxTokens: 8192,
      pricingTier: 'free',
      roles: ['general', 'reasoning', 'vision'],
      health: {
        status: 'healthy', // Known-good baseline
        lastSuccess: new Date(),
        consecutiveFailures: 0,
      },
    },
    {
      provider: 'openrouter',
      modelId: 'cohere/north-mini-code:free',
      displayName: 'North Mini Code (Free)',
      capabilities: {
        chat: false, // Code completion only
        streaming: true,
        image_generation: false,
        vision: false,
        tools: true,
        embeddings: false,
      },
      protocol: 'openrouter',
      priority: 69,
      contextWindow: 8192,
      maxTokens: 4096,
      pricingTier: 'free',
      roles: ['coding'],
      health: {
        status: 'unknown',
        consecutiveFailures: 0,
      },
    },
    {
      provider: 'openrouter',
      modelId: 'google/gemma-4-31b-it:free',
      displayName: 'Gemma 4 31B (Free)',
      capabilities: {
        chat: true,
        streaming: true,
        image_generation: false,
        vision: true,
        tools: true,
        embeddings: false,
      },
      protocol: 'openrouter',
      priority: 66,
      contextWindow: 32768,
      maxTokens: 4096,
      pricingTier: 'free',
      roles: ['general', 'vision', 'math'],
      health: {
        status: 'unknown',
        consecutiveFailures: 0,
      },
    },
  ],
};

// Helper functions
export function getModel(provider: string, modelId: string): ModelMetadata | undefined {
  return PROVIDER_REGISTRY[provider]?.find(m => m.modelId === modelId);
}

export function getAllModels(): ModelMetadata[] {
  return Object.values(PROVIDER_REGISTRY).flat();
}

export function getModelsByCapability(capability: ModelCapability): ModelMetadata[] {
  return getAllModels().filter(m => m.capabilities[capability]);
}

export function getHealthyModels(): ModelMetadata[] {
  const now = new Date();
  return getAllModels().filter(m => {
    const health = m.health;
    if (health.status === 'unhealthy') return false;
    if (health.cooldownUntil && health.cooldownUntil > now) return false;
    return true;
  });
}

export function updateModelHealth(provider: string, modelId: string, success: boolean, errorType?: ErrorType, latency?: number, ttfb?: number): void {
  const model = getModel(provider, modelId);
  if (!model) return;

  const now = new Date();
  
  if (success) {
    model.health.lastSuccess = now;
    model.health.consecutiveFailures = 0;
    model.health.status = 'healthy';
    if (latency) {
      const oldAvg = model.health.averageLatency || latency;
      model.health.averageLatency = (oldAvg * 0.9) + (latency * 0.1);
    }
    if (ttfb) {
      const oldAvg = model.health.averageTTFB || ttfb;
      model.health.averageTTFB = (oldAvg * 0.9) + (ttfb * 0.1);
    }
  } else {
    model.health.lastFailure = now;
    model.health.consecutiveFailures++;
    model.health.failureType = errorType;
    
    // Set cooldown based on error type
    if (errorType === 'RATE_LIMITED') {
      model.health.cooldownUntil = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
      model.health.status = 'degraded';
    } else if (errorType === 'AUTHENTICATION_ERROR') {
      model.health.cooldownUntil = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
      model.health.status = 'unhealthy';
    } else if (errorType === 'INVALID_MODEL') {
      model.health.cooldownUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
      model.health.status = 'unhealthy';
    } else if (model.health.consecutiveFailures >= 3) {
      model.health.cooldownUntil = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes
      model.health.status = 'degraded';
    }
  }
}
