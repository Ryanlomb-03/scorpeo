import { IntentResult, intentClassifier } from './intentClassifier';

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  api_key_param: string;
  priority: number;
  health_score: number;
}

export interface RoutingResult {
  model: ModelConfig | null;
  api_key: string;
  intent: IntentResult;
  parameters: any;
  cached?: boolean;
  cache_key?: string;
}

export class ModelRouter {
  async route(message: string): Promise<RoutingResult> {
    // Step 1: Classify intent
    const intent = intentClassifier.classify(message);
    const roles = intentClassifier.getModelRoles(intent);
    const parameters = intentClassifier.getModelParameters(intent);

    // Step 2: Skip cache for cache-only system
    
    // Step 3: Get fallback model (no database)
    const model = this.getFallbackModel(roles);
    
    if (!model) {
      throw new Error('No healthy models available for this request');
    }

    // Step 4: Get API key for the model
    const apiKey = this.getApiKey(model.api_key_param);

    return {
      model,
      api_key: apiKey,
      intent,
      parameters,
      cached: false
    };
  }

  private getFallbackModel(roles: string[]): ModelConfig | null {
    // Use default NVIDIA model for cache-only system
    return {
      id: 'nim-minimax',
      name: 'MiniMax (Fallback)',
      provider: 'NVIDIA',
      endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
      api_key_param: 'NVIDIA_API_KEY',
      priority: 100,
      health_score: 80
    };
  }

  private getApiKey(paramName: string): string {
    const key = process.env[paramName];
    if (!key) {
      console.error(`Missing API key: ${paramName}`);
      return '';
    }
    return key;
  }

  // No-op methods for cache-only system
  public async checkCache(message: string): Promise<{ hash: string; response: string } | null> {
    return null;
  }

  async updateHealth(
    modelId: string,
    latency: number,
    success: boolean,
    errorType?: string
  ): Promise<void> {
    // No-op for cache-only system
  }

  async cacheResponse(
    message: string,
    response: string,
    modelId: string,
    intentType: string,
    ttlHours: number = 24
  ): Promise<void> {
    // No-op for cache-only system
  }

  async getModelHealth(modelId: string): Promise<any> {
    return null;
  }

  async getAllModels(): Promise<any[]> {
    return [];
  }

  async getModelById(modelId: string): Promise<any> {
    return null;
  }

  async enableModel(modelId: string, enabled: boolean): Promise<boolean> {
    return false;
  }
}

export const modelRouter = new ModelRouter();
