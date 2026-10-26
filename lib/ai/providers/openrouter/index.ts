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

export class OpenRouterProvider implements AIProvider {
  id = 'openrouter';
  name = 'OpenRouter';
  
  private apiKey: string;
  private endpoint = 'https://openrouter.ai/api/v1/chat/completions';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async listModels(): Promise<ModelInfo[]> {
    // OpenRouter models - exact model IDs as specified
    return [
      {
        id: 'minimax/minimax-m3:free',
        providerId: this.id,
        displayName: 'MiniMax M3 (Free)',
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
        roles: ['reasoning', 'coding', 'agentic', 'long_context', 'vision'],
        priority: 72,
        enabled: true,
        estimatedSpeed: 700,
        contextWindow: 200000,
        status: 'healthy',
        maxTokens: 8192,
        pricingTier: 'free',
        primaryUses: ['complex reasoning', 'coding', 'agentic tasks', 'long-context work', 'multimodal input'],
        secondaryUses: [],
        supportsVision: true,
        supportsTools: true,
        supportsReasoning: true,
        supportsCode: true,
        supportsMath: true,
        supportsImageGeneration: false,
        verified: false,
      },
      {
        id: 'cohere/north-mini-code:free',
        providerId: this.id,
        displayName: 'North Mini Code (Free)',
        capabilities: {
          chat: false,
          streaming: true,
          vision: false,
          toolCalling: true,
          reasoning: true,
          embeddings: false,
          imageGeneration: false,
          codeGeneration: true,
          math: false,
          longContext: false,
        },
        roles: ['coding'],
        priority: 68,
        enabled: true,
        estimatedSpeed: 500,
        contextWindow: 8192,
        status: 'healthy',
        maxTokens: 4096,
        pricingTier: 'free',
        primaryUses: ['coding', 'software engineering', 'code completion', 'agentic coding', 'repository-level programming tasks'],
        secondaryUses: [],
        supportsVision: false,
        supportsTools: true,
        supportsReasoning: true,
        supportsCode: true,
        supportsMath: false,
        supportsImageGeneration: false,
        verified: false,
      },
      {
        id: 'google/gemma-4-31b-it:free',
        providerId: this.id,
        displayName: 'Gemma 4 31B (Free)',
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
          longContext: false,
        },
        roles: ['general', 'reasoning', 'math', 'coding', 'vision'],
        priority: 65,
        enabled: true,
        estimatedSpeed: 550,
        contextWindow: 32768,
        status: 'healthy',
        maxTokens: 4096,
        pricingTier: 'free',
        primaryUses: ['general chat', 'reasoning', 'mathematics', 'coding', 'document understanding', 'multimodal input'],
        secondaryUses: [],
        supportsVision: true,
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
    const model = request.model || 'minimax/minimax-m3:free';
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://scorpeo.ai',
        'X-Title': 'Scorpeo',
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
      throw new Error(`OpenRouter API error: ${response.status}`);
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
    const model = request.model || 'minimax/minimax-m3:free';
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://scorpeo.ai',
        'X-Title': 'Scorpeo',
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 1000,
        top_p: request.topP || 0.95,
        stream: true,
      }),
    });

    if (!response.ok) {
      yield { type: 'error', error: `OpenRouter API error: ${response.status}` };
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
              const content = data.choices[0]?.delta?.content;
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
      vision: true,
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
    return 50; // Lower priority as fallback
  }

  supportsTask(taskType: TaskType): boolean {
    const supportedTasks: TaskType[] = [
      'conversation',
      'reasoning',
      'coding',
      'vision',
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
