import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_TIMEOUTS, createTimeoutController } from '../../../lib/ai/stream/normalized';
import { PROVIDER_REGISTRY, updateModelHealth, ErrorType } from '../../../lib/ai/provider-registry';

// Diagnostic error types
export type DiagnosticErrorType =
  | 'AUTHENTICATION_ERROR'
  | 'INVALID_MODEL'
  | 'INVALID_REQUEST'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'STREAM_ERROR'
  | 'PROVIDER_ERROR'
  | 'UNKNOWN_ERROR';

export interface DiagnosticResult {
  provider: string;
  model: string;
  chatSuccess: boolean;
  chatLatency?: number;
  chatError?: string;
  chatErrorType?: DiagnosticErrorType;
  streamSuccess: boolean;
  streamTimeToFirstChunk?: number;
  streamFirstVisibleText?: string;
  streamDuration?: number;
  streamError?: string;
  streamErrorType?: DiagnosticErrorType;
  streamDiagnostics?: {
    httpStatus?: number;
    contentType?: string;
    rawChunkCount: number;
    parsedEventCount: number;
    visibleTextCharacters: number;
    firstRawChunk?: string;
  };
  status: 'READY' | 'INVALID_MODEL' | 'FAILED' | 'PARTIAL' | 'RATE_LIMITED' | 'AUTH_ERROR' | 'TIMEOUT';
  timestamp: string;
}

// Provider configurations
const PROVIDER_CONFIGS: Record<string, { endpoint: string | ((model: string) => string); headers: (key: string) => Record<string, string> }> = {
  nvidia: {
    endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    headers: (apiKey: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }),
  },
  groq: {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    headers: (apiKey: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }),
  },
  cloudflare: {
    endpoint: (model: string) => `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`,
    headers: (apiToken: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`,
    }),
  },
  gemini: {
    endpoint: (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    headers: () => ({
      'Content-Type': 'application/json',
    }),
  },
  mistral: {
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    headers: (apiKey: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }),
  },
  openrouter: {
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    headers: (apiKey: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://scorpeo.ai',
      'X-Title': 'Scorpeo',
    }),
  },
};

// Normalize error type from HTTP status and error message
function normalizeErrorType(status: number, errorMessage: string): DiagnosticErrorType {
  if (status === 401 || status === 403) return 'AUTHENTICATION_ERROR';
  if (status === 404 || errorMessage.toLowerCase().includes('model') || errorMessage.toLowerCase().includes('not found')) return 'INVALID_MODEL';
  if (status === 400) return 'INVALID_REQUEST';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVICE_UNAVAILABLE';
  if (errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('timed out')) return 'TIMEOUT';
  if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch')) return 'NETWORK_ERROR';
  if (errorMessage.toLowerCase().includes('stream')) return 'STREAM_ERROR';
  return 'PROVIDER_ERROR';
}

// Test chat endpoint with proper timeout handling
async function testChat(provider: string, model: string): Promise<{ success: boolean; latency?: number; error?: string; errorType?: DiagnosticErrorType }> {
  const startTime = Date.now();
  const timeouts = { ...DEFAULT_TIMEOUTS, connection: 5000, ttfb: 10000 }; // Faster for diagnostics
  const { controller, startTTFBTimer, clearTimeouts } = createTimeoutController(timeouts);
  
  try {
    const config = PROVIDER_CONFIGS[provider];
    if (!config) {
      return { success: false, error: `Unknown provider: ${provider}`, errorType: 'PROVIDER_ERROR' };
    }

    const endpoint = typeof config.endpoint === 'function' ? config.endpoint(model) : config.endpoint;
    const headers = config.headers(getApiKey(provider));

    const requestBody = buildRequestBody(provider, model, false);

    startTTFBTimer();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeouts();

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      const errorType = normalizeErrorType(response.status, errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}`, errorType, latency };
    }

    const data = await response.json();
    
    // Verify we got a response
    const content = extractContent(provider, data);
    if (!content) {
      return { success: false, error: 'No content in response', errorType: 'PROVIDER_ERROR', latency };
    }

    return { success: true, latency };
  } catch (error) {
    clearTimeouts();
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = normalizeErrorType(0, errorMessage);
    return { success: false, error: errorMessage, errorType, latency };
  }
}

// Test streaming endpoint with proper timeout handling and diagnostics
async function testStream(provider: string, model: string): Promise<{ 
  success: boolean; 
  timeToFirstChunk?: number; 
  firstVisibleText?: string; 
  duration?: number; 
  error?: string; 
  errorType?: DiagnosticErrorType;
  diagnostics?: {
    httpStatus?: number;
    contentType?: string;
    rawChunkCount: number;
    parsedEventCount: number;
    visibleTextCharacters: number;
    firstRawChunk?: string;
  };
}> {
  const startTime = Date.now();
  const timeouts = { ...DEFAULT_TIMEOUTS, connection: 5000, ttfb: 10000, idle: 15000, maxDuration: 30000 }; // Faster for diagnostics
  const { controller, startTTFBTimer, startIdleTimer, clearTimeouts } = createTimeoutController(timeouts);
  
  let httpStatus: number | undefined;
  let contentType: string | undefined;
  let rawChunkCount = 0;
  let parsedEventCount = 0;
  let visibleTextCharacters = 0;
  let firstRawChunk: string | undefined;
  let timeToFirstChunk: number | undefined;
  let firstVisibleText: string | undefined;
  
  try {
    const config = PROVIDER_CONFIGS[provider];
    if (!config) {
      return { success: false, error: `Unknown provider: ${provider}`, errorType: 'PROVIDER_ERROR' };
    }

    let endpoint: string;
    if (provider === 'gemini') {
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${process.env.GEMINI_API_KEY}`;
    } else if (typeof config.endpoint === 'function') {
      endpoint = config.endpoint(model);
    } else {
      endpoint = config.endpoint;
    }
    const headers = config.headers(getApiKey(provider));

    const requestBody = buildRequestBody(provider, model, true);

    startTTFBTimer();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeouts();

    httpStatus = response.status;
    contentType = response.headers.get('content-type') || undefined;

    if (!response.ok) {
      const errorText = await response.text();
      const errorType = normalizeErrorType(response.status, errorText);
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${errorText}`, 
        errorType,
        duration: Date.now() - startTime,
        diagnostics: { httpStatus, contentType, rawChunkCount, parsedEventCount, visibleTextCharacters, firstRawChunk }
      };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return { 
        success: false, 
        error: 'No response body', 
        errorType: 'STREAM_ERROR',
        duration: Date.now() - startTime,
        diagnostics: { httpStatus, contentType, rawChunkCount, parsedEventCount, visibleTextCharacters, firstRawChunk }
      };
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let totalContent = '';

    startIdleTimer();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Reset idle timer on each chunk
      startIdleTimer();

      if (timeToFirstChunk === undefined) {
        timeToFirstChunk = Date.now() - startTime;
      }

      buffer += decoder.decode(value, { stream: true });
      rawChunkCount++;
      
      // Store first raw chunk safely
      if (!firstRawChunk && buffer) {
        firstRawChunk = buffer.slice(0, 200).replace(/Bearer\s+[^\s]+/gi, 'Bearer ***');
      }
      
      // Extract content based on provider format
      const content = extractStreamContent(provider, buffer);
      if (content) {
        parsedEventCount++;
        visibleTextCharacters += content.length;
        totalContent += content;
        if (!firstVisibleText) {
          firstVisibleText = content.slice(0, 50);
        }
      }
    }
    clearTimeouts();

    const duration = Date.now() - startTime;

    if (!totalContent) {
      return { 
        success: false, 
        error: 'No content received from stream', 
        errorType: 'STREAM_ERROR',
        duration,
        diagnostics: { httpStatus, contentType, rawChunkCount, parsedEventCount, visibleTextCharacters, firstRawChunk }
      };
    }

    return { 
      success: true, 
      timeToFirstChunk, 
      firstVisibleText, 
      duration,
      diagnostics: { httpStatus, contentType, rawChunkCount, parsedEventCount, visibleTextCharacters, firstRawChunk }
    };
  } catch (error) {
    clearTimeouts();
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = normalizeErrorType(0, errorMessage);
    return { 
      success: false, 
      error: errorMessage, 
      errorType, 
      duration,
      diagnostics: { httpStatus, contentType, rawChunkCount, parsedEventCount, visibleTextCharacters, firstRawChunk }
    };
  }
}

// Helper functions
function getApiKey(provider: string): string {
  switch (provider) {
    case 'nvidia': return process.env.NVIDIA_API_KEY || '';
    case 'groq': return process.env.GROQ_API_KEY || '';
    case 'cloudflare': return process.env.CLOUDFLARE_API_TOKEN || '';
    case 'gemini': return process.env.GEMINI_API_KEY || '';
    case 'mistral': return process.env.MISTRAL_API_KEY || '';
    case 'openrouter': return process.env.OPENROUTER_API_KEY || '';
    default: return '';
  }
}

function buildRequestBody(provider: string, model: string, stream: boolean): any {
  const base = {
    model,
    messages: [{ role: 'user', content: 'Say exactly: PROVIDER_TEST_OK' }],
    temperature: 0.7,
    max_tokens: 50,
    stream,
  };

  if (provider === 'gemini') {
    return {
      contents: [{ parts: [{ text: 'Say exactly: PROVIDER_TEST_OK' }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 50,
      },
    };
  }

  if (provider === 'cloudflare') {
    return {
      messages: [{ role: 'user', content: 'Say exactly: PROVIDER_TEST_OK' }],
      temperature: 0.7,
      max_tokens: 100,
      stream,
    };
  }

  return base;
}

function extractContent(provider: string, data: any): string {
  switch (provider) {
    case 'gemini':
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    case 'cloudflare':
      return data.choices?.[0]?.message?.content || data.response || '';
    default:
      return data.choices?.[0]?.message?.content || '';
  }
}

function extractStreamContent(provider: string, buffer: string): string {
  const lines = buffer.split('\n');
  let accumulatedContent = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '[DONE]' || trimmed === 'data: [DONE]') continue;

    try {
      let data;
      if (trimmed.startsWith('data: ')) {
        data = JSON.parse(trimmed.slice(6));
      } else {
        data = JSON.parse(trimmed);
      }

      switch (provider) {
        case 'gemini':
          accumulatedContent += data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          break;
        case 'cloudflare':
          accumulatedContent += data.choices?.[0]?.delta?.content || data.response || '';
          break;
        case 'mistral':
          // Codestral uses OpenAI-compatible SSE format
          accumulatedContent += data.choices?.[0]?.delta?.content || data.choices?.[0]?.message?.content || '';
          break;
        case 'openrouter':
          // OpenRouter uses OpenAI-compatible SSE format
          accumulatedContent += data.choices?.[0]?.delta?.content || '';
          break;
        default:
          accumulatedContent += data.choices?.[0]?.delta?.content || '';
      }
    } catch {
      // Skip invalid JSON - chunks may be incomplete
    }
  }

  return accumulatedContent;
}

// Model registry - now using provider registry
const MODEL_REGISTRY = {
  nvidia: PROVIDER_REGISTRY.nvidia.map((m: any) => m.modelId),
  groq: PROVIDER_REGISTRY.groq.map((m: any) => m.modelId),
  cloudflare: PROVIDER_REGISTRY.cloudflare.map((m: any) => m.modelId),
  gemini: PROVIDER_REGISTRY.gemini.map((m: any) => m.modelId),
  mistral: PROVIDER_REGISTRY.mistral.map((m: any) => m.modelId),
  openrouter: PROVIDER_REGISTRY.openrouter.map((m: any) => m.modelId),
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const provider = searchParams.get('provider');
  const model = searchParams.get('model');

  // If specific provider/model requested, test only that
  if (provider && model) {
    const chatResult = await testChat(provider, model);
    const streamResult = await testStream(provider, model);

    const status = chatResult.success && streamResult.success 
      ? 'READY' 
      : chatResult.success || streamResult.success 
        ? 'PARTIAL' 
        : chatResult.errorType === 'INVALID_MODEL' || streamResult.errorType === 'INVALID_MODEL'
          ? 'INVALID_MODEL'
          : chatResult.errorType === 'AUTHENTICATION_ERROR' || streamResult.errorType === 'AUTHENTICATION_ERROR'
            ? 'AUTH_ERROR'
            : chatResult.errorType === 'RATE_LIMITED' || streamResult.errorType === 'RATE_LIMITED'
              ? 'RATE_LIMITED'
              : chatResult.errorType === 'TIMEOUT' || streamResult.errorType === 'TIMEOUT'
                ? 'TIMEOUT'
                : 'FAILED';

    const result: DiagnosticResult = {
      provider,
      model,
      chatSuccess: chatResult.success,
      chatLatency: chatResult.latency,
      chatError: chatResult.error,
      chatErrorType: chatResult.errorType,
      streamSuccess: streamResult.success,
      streamTimeToFirstChunk: streamResult.timeToFirstChunk,
      streamFirstVisibleText: streamResult.firstVisibleText,
      streamDuration: streamResult.duration,
      streamError: streamResult.error,
      streamErrorType: streamResult.errorType,
      streamDiagnostics: streamResult.diagnostics,
      status,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result);
  }

  // Otherwise, test all models concurrently
  const results: DiagnosticResult[] = [];
  const CONCURRENCY_LIMIT = 3; // Test up to 3 models concurrently
  const allTests: Array<{ provider: string; model: string }> = [];

  for (const [prov, models] of Object.entries(MODEL_REGISTRY)) {
    for (const mod of models) {
      allTests.push({ provider: prov, model: mod });
    }
  }

  // Process tests in batches
  for (let i = 0; i < allTests.length; i += CONCURRENCY_LIMIT) {
    const batch = allTests.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.all(
      batch.map(async ({ provider, model }) => {
        const chatResult = await testChat(provider, model);
        const streamResult = await testStream(provider, model);

        const status: 'READY' | 'INVALID_MODEL' | 'FAILED' | 'PARTIAL' | 'RATE_LIMITED' | 'AUTH_ERROR' | 'TIMEOUT' = chatResult.success && streamResult.success 
          ? 'READY' 
          : chatResult.success || streamResult.success 
            ? 'PARTIAL' 
            : chatResult.errorType === 'INVALID_MODEL' || streamResult.errorType === 'INVALID_MODEL'
              ? 'INVALID_MODEL'
              : chatResult.errorType === 'AUTHENTICATION_ERROR' || streamResult.errorType === 'AUTHENTICATION_ERROR'
                ? 'AUTH_ERROR'
                : chatResult.errorType === 'RATE_LIMITED' || streamResult.errorType === 'RATE_LIMITED'
                  ? 'RATE_LIMITED'
                  : chatResult.errorType === 'TIMEOUT' || streamResult.errorType === 'TIMEOUT'
                    ? 'TIMEOUT'
                    : 'FAILED';

        return {
          provider,
          model,
          chatSuccess: chatResult.success,
          chatLatency: chatResult.latency,
          chatError: chatResult.error,
          chatErrorType: chatResult.errorType,
          streamSuccess: streamResult.success,
          streamTimeToFirstChunk: streamResult.timeToFirstChunk,
          streamFirstVisibleText: streamResult.firstVisibleText,
          streamDuration: streamResult.duration,
          streamError: streamResult.error,
          streamErrorType: streamResult.errorType,
          streamDiagnostics: streamResult.diagnostics,
          status,
          timestamp: new Date().toISOString(),
        };
      })
    );
    results.push(...batchResults);
  }

  return NextResponse.json({ results, timestamp: new Date().toISOString() });
}
