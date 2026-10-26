/**
 * Normalized Stream Format for AI Providers
 * 
 * This defines a unified streaming format that all provider adapters must emit.
 * The frontend should only consume this format, not provider-specific formats.
 */

export interface StreamUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface StreamError {
  code: 'RATE_LIMITED' | 'AUTH_ERROR' | 'TIMEOUT' | 'PROVIDER_ERROR' | 'INVALID_REQUEST' | 'MODEL_UNAVAILABLE' | 'CANCELLED' | 'UNKNOWN';
  message: string;
  providerId?: string;
  modelId?: string;
  retryAfter?: number; // seconds
}

export type StreamEvent =
  | {
      type: 'start';
      providerId: string;
      modelId: string;
    }
  | {
      type: 'thinking';
      content: string;
    }
  | {
      type: 'text';
      content: string;
    }
  | {
      type: 'tool_call';
      content: unknown;
    }
  | {
      type: 'usage';
      usage: StreamUsage;
    }
  | {
      type: 'error';
      error: StreamError;
    }
  | {
      type: 'done';
    };

/**
 * Stream Metrics for performance monitoring
 */
export interface StreamMetrics {
  requestStarted: number; // timestamp
  routingCompleted: number; // timestamp
  providerRequestStarted: number; // timestamp
  providerConnectionEstablished: number; // timestamp
  firstTokenReceived: number; // timestamp
  firstVisibleContent: number; // timestamp
  generationCompleted: number; // timestamp
  
  // Calculated metrics
  routingLatency: number; // ms
  timeToFirstToken: number; // ms
  timeToFirstVisibleContent: number; // ms
  tokensPerSecond: number; // tokens/sec
  totalGenerationTime: number; // ms
}

/**
 * Provider performance history for intelligent routing
 */
export interface ProviderPerformance {
  providerId: string;
  modelId: string;
  
  // Performance metrics
  averageLatency: number; // ms
  averageTTFT: number; // ms
  tokensPerSecond: number; // tokens/sec
  
  // Reliability metrics
  recentErrors: number; // count in time window
  recent429s: number; // count in time window
  successRate: number; // 0-1
  
  // Rate limit state
  cooldownUntil?: number; // timestamp
  rateLimitReset?: number; // timestamp
  
  // Timestamps
  lastRequest: number; // timestamp
  lastSuccess: number; // timestamp
  lastError: number; // timestamp
}

/**
 * Normalize provider errors to standard error codes
 */
export function normalizeError(error: unknown, providerId?: string, modelId?: string): StreamError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Rate limit errors
  if (errorMessage.includes('429') || 
      errorMessage.includes('rate limit') || 
      errorMessage.includes('too many requests')) {
    return {
      code: 'RATE_LIMITED',
      message: errorMessage,
      providerId,
      modelId,
      retryAfter: extractRetryAfter(errorMessage),
    };
  }
  
  // Authentication errors
  if (errorMessage.includes('401') || 
      errorMessage.includes('unauthorized') || 
      errorMessage.includes('authentication') ||
      errorMessage.includes('invalid api key')) {
    return {
      code: 'AUTH_ERROR',
      message: errorMessage,
      providerId,
      modelId,
    };
  }
  
  // Timeout errors
  if (errorMessage.includes('timeout') || 
      errorMessage.includes('AbortError') ||
      errorMessage.includes('ETIMEDOUT')) {
    return {
      code: 'TIMEOUT',
      message: errorMessage,
      providerId,
      modelId,
    };
  }
  
  // Model unavailable errors
  if (errorMessage.includes('model not found') || 
      errorMessage.includes('model unavailable') ||
      errorMessage.includes('404')) {
    return {
      code: 'MODEL_UNAVAILABLE',
      message: errorMessage,
      providerId,
      modelId,
    };
  }
  
  // Invalid request errors
  if (errorMessage.includes('400') || 
      errorMessage.includes('bad request') ||
      errorMessage.includes('invalid request')) {
    return {
      code: 'INVALID_REQUEST',
      message: errorMessage,
      providerId,
      modelId,
    };
  }
  
  // Default to provider error
  return {
    code: 'PROVIDER_ERROR',
    message: errorMessage,
    providerId,
    modelId,
  };
}

/**
 * Extract retry-after value from error message or headers
 */
function extractRetryAfter(errorMessage: string): number | undefined {
  // Try to extract retry-after from common patterns
  const retryAfterMatch = errorMessage.match(/retry-after[:\s]*(\d+)/i);
  if (retryAfterMatch) {
    return parseInt(retryAfterMatch[1], 10);
  }
  
  // Default retry-after for rate limits (60 seconds)
  return 60;
}

/**
 * Create a normalized stream format
 */
export function createStreamEvent(event: Omit<StreamEvent, 'type'>, type: StreamEvent['type']): StreamEvent {
  return { type, ...event } as StreamEvent;
}

/**
 * Serialize a stream event for transmission
 */
export function serializeStreamEvent(event: StreamEvent): string {
  return JSON.stringify(event);
}

/**
 * Deserialize a stream event from transmission
 */
export function deserializeStreamEvent(data: string): StreamEvent {
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to deserialize stream event:', e);
    throw new Error('Invalid stream event format');
  }
}

/**
 * Check if an event is a content event (thinking or text)
 */
export function isContentEvent(event: StreamEvent): event is { type: 'thinking' | 'text'; content: string } {
  return event.type === 'thinking' || event.type === 'text';
}

/**
 * Check if an event is an error event
 */
export function isErrorEvent(event: StreamEvent): event is { type: 'error'; error: StreamError } {
  return event.type === 'error';
}

/**
 * Check if an event is a terminal event
 */
export function isTerminalEvent(event: StreamEvent): boolean {
  return event.type === 'error' || event.type === 'done';
}
