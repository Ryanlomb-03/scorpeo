// Core AI Provider Types and Interfaces

export type ModelRole =
  | 'general'
  | 'fast'
  | 'reasoning'
  | 'coding'
  | 'math'
  | 'education'
  | 'research'
  | 'long_context'
  | 'vision'
  | 'image_generation'
  | 'tool_use'
  | 'agentic'
  | 'safety'
  | 'classification'
  | 'summarization';

export type TaskType =
  | 'conversation'
  | 'reasoning'
  | 'coding'
  | 'vision'
  | 'summarization'
  | 'creative'
  | 'education'
  | 'long_context'
  | 'fast_response'
  | 'math'
  | 'research'
  | 'image_generation'
  | 'safety_check'
  | 'classification';

export type ModelCapabilities = {
  chat: boolean;
  streaming: boolean;
  vision: boolean;
  toolCalling: boolean;
  reasoning: boolean;
  embeddings: boolean;
  imageGeneration: boolean;
  codeGeneration: boolean;
  math: boolean;
  longContext: boolean;
};

export type ProviderStatus = 'healthy' | 'cooldown' | 'disabled' | 'unknown';

export type ModelStatus = 'healthy' | 'cooldown' | 'disabled' | 'deprecated' | 'unknown';

export interface UsageInfo {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AIRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | Array<{ type: string; text?: string; image_url?: string }>;
    tool_calls?: any[];
    tool_call_id?: string;
  }>;
  model?: string; // Explicit model ID - must be used by provider, no silent fallback
  taskType: TaskType;
  capabilities: Partial<ModelCapabilities>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  reasoning_effort?: string;
  stream?: boolean;
  tools?: any[];
  signal?: AbortSignal;
}

export interface AIResponse {
  content: string;
  toolCalls?: any[];
  usage?: UsageInfo;
  model: string;
  provider: string;
}

export interface AIStreamChunk {
  type: 'text' | 'tool_call' | 'usage' | 'error' | 'done' | 'thinking';
  content?: string;
  toolCall?: any;
  usage?: UsageInfo;
  error?: string;
}

export interface ProviderHealth {
  status: ProviderStatus;
  lastCheck: Date;
  consecutiveErrors: number;
  lastError?: string;
  cooldownUntil?: Date;
  averageLatency: number;
}

export interface ModelInfo {
  id: string;
  providerId: string;
  displayName: string;
  capabilities: ModelCapabilities;
  roles: ModelRole[];
  priority: number;
  enabled: boolean;
  estimatedSpeed?: number;
  contextWindow?: number;
  status: ModelStatus;
  maxTokens?: number;
  pricingTier?: 'free' | 'paid' | 'custom';
  primaryUses: string[];
  secondaryUses?: string[];
  supportsVision?: boolean;
  supportsTools?: boolean;
  supportsReasoning?: boolean;
  supportsCode?: boolean;
  supportsMath?: boolean;
  supportsImageGeneration?: boolean;
  verified?: boolean;
}

export interface RoutingTarget {
  providerId: string;
  endpointId: string;
  modelId: string;
  status: ProviderStatus;
}

export interface ProviderState {
  requestsPerMinute: number;
  requestsToday: number;
  tokensUsed: number;
  lastRequest: Date;
  lastError?: Date;
  consecutiveErrors: number;
  cooldownUntil?: Date;
  latency: number;
}

export interface AIProvider {
  id: string;
  name: string;
  
  listModels(): Promise<ModelInfo[]>;
  
  chat(request: AIRequest): Promise<AIResponse>;
  
  stream(request: AIRequest): AsyncIterable<AIStreamChunk>;
  
  getHealth(): ProviderHealth;
  
  isAvailable(model?: string): boolean;
  
  getCapabilities(): ModelCapabilities;
  
  getPriority(): number;
  
  supportsTask(taskType: TaskType): boolean;
}

export interface RoutingDecision {
  providerId: string;
  modelId: string;
  reason: string;
  score: number;
  fallbackAttempts: number;
  estimatedLatency?: number;
}

export interface RoutingLog {
  requestId: string;
  task: TaskType;
  selectedProvider: string;
  selectedModel: string;
  reason: string;
  fallbackAttempts: number;
  latencyMs?: number;
  status: 'success' | 'failure';
  timestamp: Date;
}
