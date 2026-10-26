import {
  AIProvider,
  AIRequest,
  AIResponse,
  AIStreamChunk,
  ModelInfo,
  ModelCapabilities,
  ProviderHealth,
  TaskType,
} from '../../types';

export class NVIDIAProvider implements AIProvider {
  id = 'nvidia';
  name = 'NVIDIA NIM';
  
  private apiKey: string;
  private endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async listModels(): Promise<ModelInfo[]> {
    // NVIDIA NIM models - exact model IDs as specified
    return [
      {
        id: 'deepseek-ai/deepseek-v4.1-flash',
        providerId: this.id,
        displayName: 'DeepSeek V4.1 Flash',
        capabilities: {
          chat: true,
          streaming: true,
          vision: true,
          toolCalling: true,
          reasoning: true,
          embeddings: false,
          imageGeneration: false,
          codeGeneration: true,
          math: true,
          longContext: true,
        },
        roles: ['fast', 'reasoning', 'coding', 'vision', 'agentic'],
        priority: 98,
        enabled: true,
        estimatedSpeed: 1500,
        contextWindow: 1000000,
        status: 'healthy',
        maxTokens: 131072,
        pricingTier: 'free',
        primaryUses: ['fast reasoning', 'vision tasks', 'coding', 'general chat', 'tool calling'],
        secondaryUses: ['mathematics', 'research', 'long-context analysis'],
        supportsVision: true,
        supportsTools: true,
        supportsReasoning: true,
        supportsCode: true,
        supportsMath: true,
        supportsImageGeneration: false,
        verified: true,
      },
      {
        id: 'deepseek-ai/deepseek-v4-pro-0813',
        providerId: this.id,
        displayName: 'DeepSeek V4 Pro 0813',
        capabilities: {
          chat: true,
          streaming: true,
          vision: false,
          toolCalling: true,
          reasoning: true,
          embeddings: false,
          imageGeneration: false,
          codeGeneration: true,
          math: true,
          longContext: true,
        },
        roles: ['reasoning', 'coding', 'math', 'agentic', 'long_context'],
        priority: 95,
        enabled: false, // Disabled: HTTP 410 Deprecated
        estimatedSpeed: 1200,
        contextWindow: 128000,
        status: 'deprecated',
        maxTokens: 8192,
        pricingTier: 'paid',
        primaryUses: ['advanced coding', 'software engineering', 'difficult reasoning', 'mathematics', 'complex problem solving', 'agentic workflows', 'architecture', 'long-context analysis'],
        secondaryUses: ['general chat', 'technical explanations', 'research synthesis'],
        supportsVision: false,
        supportsTools: true,
        supportsReasoning: true,
        supportsCode: true,
        supportsMath: true,
        supportsImageGeneration: false,
        verified: false,
      },
      {
        id: 'moonshotai/kimi-k3',
        providerId: this.id,
        displayName: 'Kimi K3',
        capabilities: {
          chat: true,
          streaming: true,
          vision: false,
          toolCalling: true,
          reasoning: true,
          embeddings: false,
          imageGeneration: false,
          codeGeneration: true,
          math: true,
          longContext: true,
        },
        roles: ['long_context', 'reasoning', 'coding', 'agentic'],
        priority: 88,
        enabled: true,
        estimatedSpeed: 900,
        contextWindow: 200000,
        status: 'healthy',
        maxTokens: 8192,
        pricingTier: 'paid',
        primaryUses: ['long-context reasoning', 'research', 'coding', 'large-document analysis', 'complex conversations', 'agentic tasks'],
        secondaryUses: ['general chat', 'planning', 'technical analysis'],
        supportsVision: false,
        supportsTools: true,
        supportsReasoning: true,
        supportsCode: true,
        supportsMath: true,
        supportsImageGeneration: false,
        verified: false,
      },
      {
        id: 'openai/gpt-oss-20b',
        providerId: this.id,
        displayName: 'GPT-OSS 20B',
        capabilities: {
          chat: true,
          streaming: true,
          vision: false,
          toolCalling: true,
          reasoning: true,
          embeddings: false,
          imageGeneration: false,
          codeGeneration: true,
          math: true,
          longContext: false,
        },
        roles: ['fast', 'general', 'coding', 'math', 'education'],
        priority: 75,
        enabled: true,
        estimatedSpeed: 400,
        contextWindow: 8192,
        status: 'healthy',
        maxTokens: 4096,
        pricingTier: 'paid',
        primaryUses: ['fast general chat', 'everyday questions', 'lightweight reasoning', 'mathematics', 'coding', 'structured responses'],
        secondaryUses: ['summarization', 'education', 'simple tool tasks'],
        supportsVision: false,
        supportsTools: true,
        supportsReasoning: true,
        supportsCode: true,
        supportsMath: true,
        supportsImageGeneration: false,
        verified: false,
      },
    ];
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const model = request.model || 'deepseek-ai/deepseek-v4-pro-0813';
    
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 1000,
        top_p: request.topP || 0.95,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`NVIDIA API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      },
      model: data.model,
      provider: this.id,
    };
  }

  async *stream(request: AIRequest): AsyncIterable<AIStreamChunk> {
    const model = request.model || 'deepseek-ai/deepseek-v4-pro-0813';
    
    const abortController = new AbortController();
    const signal = request.signal || abortController.signal;
    
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 1000,
        top_p: request.topP || 0.95,
        reasoning_effort: request.reasoning_effort || 'low',
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      yield { type: 'error', error: `NVIDIA API error: ${response.status}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === '' || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const delta = data.choices[0]?.delta;
              
              // Use native reasoning_content field from NVIDIA API
              if (delta?.reasoning_content) {
                yield { type: 'thinking', content: delta.reasoning_content };
              }
              
              // Use native content field for visible text
              if (delta?.content) {
                yield { type: 'text', content: delta.content };
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[NVIDIA Provider] Stream aborted by client');
        yield { type: 'error', error: 'Stream cancelled' };
      } else {
        console.error('[NVIDIA Provider] Stream error:', error);
        yield { type: 'error', error: 'Stream error' };
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: 'done' };
  }

  getHealth(): ProviderHealth {
    return {
      status: 'healthy',
      lastCheck: new Date(),
      consecutiveErrors: 0,
      averageLatency: 800,
    };
  }

  isAvailable(model?: string): boolean {
    return !!this.apiKey;
  }

  getCapabilities(): ModelCapabilities {
    return {
      chat: true,
      streaming: true,
      vision: false,
      toolCalling: true,
      reasoning: true,
      embeddings: false,
      imageGeneration: false,
      codeGeneration: true,
      math: true,
      longContext: false,
    };
  }

  getPriority(): number {
    return 90;
  }

  supportsTask(taskType: TaskType): boolean {
    const supportedTasks: TaskType[] = [
      'conversation',
      'reasoning',
      'coding',
      'summarization',
      'creative',
      'education',
      'long_context',
      'math',
      'research',
    ];
    return supportedTasks.includes(taskType);
  }
}
