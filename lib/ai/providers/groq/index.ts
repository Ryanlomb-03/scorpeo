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

export class GroqProvider implements AIProvider {
  id = 'groq';
  name = 'Groq';
  
  private apiKey: string;
  private endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async listModels(): Promise<ModelInfo[]> {
    // Groq models - exact model IDs as specified
    return [
      {
        id: 'meta-llama/llama-prompt-guard-2-22m',
        providerId: this.id,
        displayName: 'LLaMA Prompt Guard',
        capabilities: {
          chat: false,
          streaming: false,
          vision: false,
          toolCalling: false,
          reasoning: false,
          embeddings: false,
          imageGeneration: false,
          codeGeneration: false,
          math: false,
          longContext: false,
        },
        roles: ['classification', 'safety'],
        priority: 10,
        enabled: true,
        estimatedSpeed: 100,
        contextWindow: 4096,
        status: 'healthy',
        maxTokens: 100,
        pricingTier: 'free',
        primaryUses: ['text classification', 'safety filtering', 'content moderation'],
        secondaryUses: [],
        supportsVision: false,
        supportsTools: false,
        supportsReasoning: false,
        supportsCode: false,
        supportsMath: false,
        supportsImageGeneration: false,
        verified: false,
      },
      {
        id: 'qwen/qwen3.6-27b',
        providerId: this.id,
        displayName: 'Qwen 3.6 27B',
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
        roles: ['general', 'coding', 'math', 'reasoning', 'education'],
        priority: 82,
        enabled: true,
        estimatedSpeed: 350,
        contextWindow: 32768,
        status: 'healthy',
        maxTokens: 8192,
        pricingTier: 'free',
        primaryUses: ['general chat', 'coding', 'mathematics', 'reasoning', 'technical questions', 'education', 'multilingual tasks'],
        secondaryUses: ['summarization', 'structured generation'],
        supportsVision: false,
        supportsTools: true,
        supportsReasoning: true,
        supportsCode: true,
        supportsMath: true,
        supportsImageGeneration: false,
        verified: false,
      },
      {
        id: 'openai/gpt-oss-120b',
        providerId: this.id,
        displayName: 'GPT-OSS 120B',
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
        roles: ['reasoning', 'coding', 'math', 'agentic'],
        priority: 90,
        enabled: true,
        estimatedSpeed: 600,
        contextWindow: 32768,
        status: 'healthy',
        maxTokens: 8192,
        pricingTier: 'free',
        primaryUses: ['advanced reasoning', 'coding', 'difficult mathematics', 'architecture', 'agentic tasks', 'complex technical problems'],
        secondaryUses: ['general high-quality chat', 'planning', 'analysis'],
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
    const model = request.model || 'qwen/qwen3.6-27b';
    
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
      throw new Error(`Groq API error: ${response.status}`);
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
    const model = request.model || 'qwen/qwen3.6-27b';
    
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
        stream: true,
      }),
    });

    if (!response.ok) {
      yield { type: 'error', error: `Groq API error: ${response.status}` };
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
      averageLatency: 300,
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
    return 85;
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
