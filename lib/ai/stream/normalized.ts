// Normalized Streaming Interface
// All providers must convert their native responses to these unified events

export type StreamEventType = 
  | 'START'
  | 'TEXT_DELTA'
  | 'THINKING_DELTA'
  | 'TOOL_CALL'
  | 'IMAGE'
  | 'DONE'
  | 'ERROR';

export interface StreamEvent {
  type: StreamEventType;
  content?: string;
  toolName?: string;
  toolArgs?: any;
  imageUrl?: string;
  error?: string;
  errorType?: string;
  finishReason?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface StreamDiagnostics {
  provider: string;
  model: string;
  httpStatus?: number;
  contentType?: string;
  ttfb?: number; // Time to first byte
  rawChunkCount: number;
  parsedEventCount: number;
  visibleTextCharacters: number;
  finishReason?: string;
  streamDuration: number;
  error?: string;
  firstRawChunk?: string; // Safely logged for debugging
}

export class NormalizedStream {
  private provider: string;
  private model: string;
  private startTime: number;
  private firstByteTime?: number;
  private rawChunkCount = 0;
  private parsedEventCount = 0;
  private visibleTextCharacters = 0;
  private firstRawChunk?: string;

  constructor(provider: string, model: string) {
    this.provider = provider;
    this.model = model;
    this.startTime = Date.now();
  }

  recordFirstByte() {
    if (!this.firstByteTime) {
      this.firstByteTime = Date.now();
    }
  }

  recordRawChunk(chunk: string) {
    this.rawChunkCount++;
    if (!this.firstRawChunk && chunk) {
      // Store first chunk safely (redact any potential secrets)
      this.firstRawChunk = chunk.slice(0, 200).replace(/Bearer\s+[^\s]+/gi, 'Bearer ***');
    }
  }

  recordParsedEvent() {
    this.parsedEventCount++;
  }

  recordTextDelta(content: string) {
    this.visibleTextCharacters += content.length;
  }

  getDiagnostics(error?: string, finishReason?: string): StreamDiagnostics {
    return {
      provider: this.provider,
      model: this.model,
      ttfb: this.firstByteTime ? this.firstByteTime - this.startTime : undefined,
      rawChunkCount: this.rawChunkCount,
      parsedEventCount: this.parsedEventCount,
      visibleTextCharacters: this.visibleTextCharacters,
      finishReason,
      streamDuration: Date.now() - this.startTime,
      error,
      firstRawChunk: this.firstRawChunk,
    };
  }
}

// Timeout configuration
export interface StreamTimeouts {
  connection: number; // Connection timeout
  ttfb: number; // Time to first byte timeout
  idle: number; // Idle stream timeout (reset on each chunk)
  maxDuration: number; // Maximum total generation duration
}

export const DEFAULT_TIMEOUTS: StreamTimeouts = {
  connection: 10000, // 10 seconds
  ttfb: 15000, // 15 seconds
  idle: 30000, // 30 seconds
  maxDuration: 120000, // 2 minutes
};

// Create abort controller with cascading timeouts
export function createTimeoutController(timeouts: StreamTimeouts): {
  controller: AbortController;
  startTTFBTimer: () => void;
  startIdleTimer: () => void;
  clearTimeouts: () => void;
} {
  const controller = new AbortController();
  let ttfbTimer: NodeJS.Timeout | null = null;
  let idleTimer: NodeJS.Timeout | null = null;

  const startTTFBTimer = () => {
    if (ttfbTimer) clearTimeout(ttfbTimer);
    ttfbTimer = setTimeout(() => {
      controller.abort(new Error('TTFB timeout'));
    }, timeouts.ttfb);
  };

  const startIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      controller.abort(new Error('Idle stream timeout'));
    }, timeouts.idle);
  };

  const clearTimeouts = () => {
    if (ttfbTimer) clearTimeout(ttfbTimer);
    if (idleTimer) clearTimeout(idleTimer);
  };

  // Set overall connection timeout
  setTimeout(() => {
    controller.abort(new Error('Connection timeout'));
  }, timeouts.connection);

  return {
    controller,
    startTTFBTimer,
    startIdleTimer,
    clearTimeouts,
  };
}
