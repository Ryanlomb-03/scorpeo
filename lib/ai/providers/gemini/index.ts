import { AIProvider, AIRequest, AIResponse, AIStreamChunk, ProviderHealth } from '../../types';

export class GeminiProvider implements AIProvider {
  id = 'gemini';
  name = 'Google Gemini';
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const model = request.model || 'gemini-3.8-flash';
    const endpoint = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: request.messages.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })),
        generationConfig: {
          temperature: request.temperature || 0.7,
          maxOutputTokens: request.maxTokens || 8192,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      provider: 'gemini',
      content,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
      model,
    };
  }

  async *stream(request: AIRequest): AsyncIterable<AIStreamChunk> {
    const model = request.model || 'gemini-3.8-flash';
    const endpoint = `${this.baseUrl}/models/${model}:streamGenerateContent?key=${this.apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: request.messages.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })),
        generationConfig: {
          temperature: request.temperature || 0.7,
          maxOutputTokens: request.maxTokens || 8192,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      yield { type: 'error', error: `Gemini API error: ${response.status} - ${error}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No readable stream' };
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

          try {
            if (trimmed.startsWith('data: ')) {
              const data = JSON.parse(trimmed.slice(6));
              const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (content) {
                yield { type: 'text', content };
              }
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: 'done' };
  }

  async listModels(): Promise<any[]> {
    return [
      {
        id: 'gemini-3.8-flash',
        providerId: 'gemini',
        displayName: 'Gemini 3.8 Flash',
        capabilities: { chat: true, streaming: true, vision: true, toolCalling: true },
        priority: 93,
        enabled: true,
        estimatedSpeed: 'fast',
        contextWindow: 1000000,
        maxTokens: 8192,
      },
      {
        id: 'gemini-3.5-flash-lite',
        providerId: 'gemini',
        displayName: 'Gemini 3.5 Flash Lite',
        capabilities: { chat: true, streaming: true, vision: false, toolCalling: true },
        priority: 81,
        enabled: true,
        estimatedSpeed: 'fast',
        contextWindow: 32768,
        maxTokens: 4096,
      },
      {
        id: 'gemini-3.1-pro-preview',
        providerId: 'gemini',
        displayName: 'Gemini 3.1 Pro Preview',
        capabilities: { chat: true, streaming: true, vision: true, toolCalling: true },
        priority: 95,
        enabled: true,
        estimatedSpeed: 'medium',
        contextWindow: 2000000,
        maxTokens: 8192,
      },
    ];
  }

  getHealth(): ProviderHealth {
    return {
      status: 'healthy',
      lastCheck: new Date(),
      consecutiveErrors: 0,
      averageLatency: 1000,
    };
  }

  isAvailable(model?: string): boolean {
    return !!this.apiKey;
  }

  getCapabilities() {
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
      longContext: true,
    };
  }

  supportsTask(taskType: string): boolean {
    return ['conversation', 'reasoning', 'coding', 'vision', 'research'].includes(taskType);
  }

  getPriority(): number {
    return 95;
  }
}
