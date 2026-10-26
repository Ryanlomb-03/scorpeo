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

export class CloudflareProvider implements AIProvider {
  id = 'cloudflare';
  name = 'Cloudflare Workers AI';
  
  private accountId: string;
  private apiToken: string;
  private endpoint: string;
  
  constructor(accountId: string, apiToken: string) {
    this.accountId = accountId;
    this.apiToken = apiToken;
    // Use OpenAI-compatible endpoint for consistency
    this.endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
  }

  async listModels(): Promise<ModelInfo[]> {
    // Cloudflare Workers AI models - exact model IDs as specified
    return [
      {
        id: 'anthropic/claude-fable-5.1',
        providerId: this.id,
        displayName: 'Claude Fable 5.1',
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
        roles: ['general', 'reasoning', 'coding', 'education'],
        priority: 72,
        enabled: true,
        estimatedSpeed: 700,
        contextWindow: 200000,
        status: 'healthy',
        maxTokens: 8192,
        pricingTier: 'paid',
        primaryUses: ['general conversation', 'reasoning', 'writing', 'coding', 'education', 'analysis'],
        secondaryUses: [],
        supportsVision: false,
        supportsTools: true,
        supportsReasoning: true,
        supportsCode: true,
        supportsMath: true,
        supportsImageGeneration: false,
        verified: false,
      },
      {
        id: 'xai/grok-imagine-image-2.0',
        providerId: this.id,
        displayName: 'Grok Imagine Image 2.0',
        capabilities: {
          chat: false,
          streaming: false,
          vision: false,
          toolCalling: false,
          reasoning: false,
          embeddings: false,
          imageGeneration: true,
          codeGeneration: false,
          math: false,
          longContext: false,
        },
        roles: ['image_generation'],
        priority: 60,
        enabled: true,
        estimatedSpeed: 2000,
        contextWindow: 4096,
        status: 'healthy',
        maxTokens: 100,
        pricingTier: 'paid',
        primaryUses: ['text to image generation'],
        secondaryUses: [],
        supportsVision: false,
        supportsTools: false,
        supportsReasoning: false,
        supportsCode: false,
        supportsMath: false,
        supportsImageGeneration: true,
        verified: false,
      },
      {
        id: 'xai/grok-4.6',
        providerId: this.id,
        displayName: 'Grok 4.6',
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
        roles: ['reasoning', 'general', 'coding', 'research'],
        priority: 78,
        enabled: true,
        estimatedSpeed: 800,
        contextWindow: 131072,
        status: 'healthy',
        maxTokens: 8192,
        pricingTier: 'paid',
        primaryUses: ['reasoning', 'general chat', 'coding', 'analysis', 'research-style tasks', 'complex questions'],
        secondaryUses: [],
        supportsVision: false,
        supportsTools: true,
        supportsReasoning: true,
        supportsCode: true,
        supportsMath: true,
        supportsImageGeneration: false,
        verified: false,
      },
      {
        id: 'alibaba/qwen3.7-max',
        providerId: this.id,
        displayName: 'Qwen 3.7 Max',
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
        roles: ['general', 'reasoning', 'coding', 'math', 'education'],
        priority: 74,
        enabled: true,
        estimatedSpeed: 650,
        contextWindow: 32768,
        status: 'healthy',
        maxTokens: 8192,
        pricingTier: 'paid',
        primaryUses: ['general chat', 'reasoning', 'coding', 'mathematics', 'technical analysis', 'multilingual tasks'],
        secondaryUses: [],
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
    const model = request.model || 'anthropic/claude-fable-5.1';
    const response = await fetch(`${this.endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiToken}`,
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 1000,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Cloudflare API error: ${response.status}`);
    }

    const data = await response.json();
    
    // OpenAI-compatible format
    const content = data.choices?.[0]?.message?.content || '';
    
    return {
      content,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      },
      model,
      provider: this.id,
    };
  }

  async *stream(request: AIRequest): AsyncIterable<AIStreamChunk> {
    const model = request.model || 'anthropic/claude-fable-5.1';
    const response = await fetch(`${this.endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiToken}`,
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 1000,
        stream: true,
      }),
    });

    if (!response.ok) {
      yield { type: 'error', error: `Cloudflare API error: ${response.status}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedContent = '';
    const THINK_OPEN_TAG = '</think>';
    const THINK_CLOSE_TAG = '</think>';

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
              // OpenAI-compatible format
              const content = data.choices?.[0]?.delta?.content;
              if (content) {
                accumulatedContent += content;
                
                // Parse for thinking tags
                const openIndex = accumulatedContent.indexOf(THINK_OPEN_TAG);
                const closeIndex = accumulatedContent.indexOf(THINK_CLOSE_TAG);
                
                if (openIndex !== -1 && closeIndex === -1) {
                  // Currently streaming thinking content
                  const thinkingContent = accumulatedContent.slice(openIndex + THINK_OPEN_TAG.length);
                  yield { type: 'thinking', content: thinkingContent };
                } else if (openIndex !== -1 && closeIndex !== -1) {
                  // Thinking block complete, yield it
                  const thinkingContent = accumulatedContent.slice(openIndex + THINK_OPEN_TAG.length, closeIndex);
                  yield { type: 'thinking', content: thinkingContent };
                  
                  // Yield remaining text content
                  const textContent = accumulatedContent.slice(closeIndex + THINK_CLOSE_TAG.length);
                  if (textContent) {
                    yield { type: 'text', content: textContent };
                  }
                  
                  accumulatedContent = '';
                } else if (closeIndex !== -1 && openIndex === -1) {
                  // Close tag without open - treat as text
                  yield { type: 'text', content: accumulatedContent };
                  accumulatedContent = '';
                } else if (openIndex === -1 && closeIndex === -1) {
                  // No thinking tags, yield as text
                  yield { type: 'text', content: content };
                }
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
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
      averageLatency: 500,
    };
  }

  isAvailable(model?: string): boolean {
    return !!this.accountId && !!this.apiToken;
  }

  getCapabilities(): ModelCapabilities {
    return {
      chat: true,
      streaming: true,
      vision: false,
      toolCalling: false,
      reasoning: true,
      embeddings: false,
      imageGeneration: false,
      codeGeneration: false,
      math: false,
      longContext: false,
    };
  }

  getPriority(): number {
    return 70;
  }

  supportsTask(taskType: TaskType): boolean {
    const supportedTasks: TaskType[] = [
      'conversation',
      'reasoning',
      'coding',
      'summarization',
      'creative',
      'education',
      'fast_response',
      'math',
      'research',
    ];
    return supportedTasks.includes(taskType);
  }
}
