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

export class MistralProvider implements AIProvider {
  id = 'mistral';
  name = 'Mistral AI';
  
  private apiKey: string;
  private endpoint = 'https://api.mistral.ai/v1/chat/completions';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async listModels(): Promise<ModelInfo[]> {
    // Mistral models - correct model IDs from Mistral API
    return [
      {
        id: 'mistral-large-latest',
        providerId: this.id,
        displayName: 'Mistral Large',
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
        priority: 86,
        enabled: true,
        estimatedSpeed: 750,
        contextWindow: 32768,
        status: 'healthy',
        maxTokens: 8192,
        pricingTier: 'paid',
        primaryUses: ['reasoning', 'coding', 'mathematics', 'complex analysis', 'technical tasks', 'agentic workflows'],
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
        id: 'mistral-small-latest',
        providerId: this.id,
        displayName: 'Mistral Small',
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
        roles: ['fast', 'general', 'coding', 'summarization', 'education'],
        priority: 76,
        enabled: true,
        estimatedSpeed: 400,
        contextWindow: 32768,
        status: 'healthy',
        maxTokens: 8192,
        pricingTier: 'paid',
        primaryUses: ['fast general chat', 'coding', 'summarization', 'education', 'structured responses', 'lightweight reasoning'],
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
        id: 'codestral-latest',
        providerId: this.id,
        displayName: 'Codestral',
        capabilities: {
          chat: true,
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
        priority: 82,
        enabled: true,
        estimatedSpeed: 550,
        contextWindow: 32768,
        status: 'healthy',
        maxTokens: 8192,
        pricingTier: 'paid',
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
    ];
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const model = request.model || 'mistral-small-latest';
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
      throw new Error(`Mistral API error: ${response.status}`);
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
    const model = request.model || 'mistral-small-latest';
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
      yield { type: 'error', error: `Mistral API error: ${response.status}` };
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
                yield { type: 'text', content };
              }
            } catch (e) {
              // Skip invalid JSON - chunks may be incomplete
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
      averageLatency: 700,
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
    return 88;
  }

  supportsTask(taskType: TaskType): boolean {
    const supportedTasks: TaskType[] = [
      'conversation',
      'reasoning',
      'coding',
      'summarization',
      'creative',
      'education',
      'math',
      'research',
    ];
    return supportedTasks.includes(taskType);
  }
}
