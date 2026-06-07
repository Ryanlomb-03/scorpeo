import supabase from './db';
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

    // Step 2: Check cache first
    const cached = await this.checkCache(message);
    if (cached) {
      return {
        model: null,
        api_key: '',
        intent,
        parameters,
        cached: true,
        cache_key: cached.hash
      };
    }

    // Step 3: Get best model for this intent
    const model = await this.selectBestModel(roles);
    
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

  private async selectBestModel(roles: string[]): Promise<ModelConfig | null> {
    try {
      // Get all healthy models first, then filter by roles in application
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('enabled', true)
        .eq('status', 'active')
        .order('priority', { ascending: false });

      if (error) {
        console.error('Error selecting best model:', error);
        return this.getFallbackModel(roles);
      }

      if (!data || data.length === 0) {
        return this.getFallbackModel(roles);
      }

      // Filter by roles and calculate health score in application
      const filteredModels = (data as any[]).filter(model => {
        return roles.some(role => model.roles.includes(role));
      });

      if (filteredModels.length === 0) {
        return this.getFallbackModel(roles);
      }

      // Calculate health score and sort
      const scoredModels = filteredModels.map(model => ({
        ...model,
        health_score: this.calculateHealthScore(model)
      }));

      scoredModels.sort((a, b) => {
        // Sort by health score descending, then latency ascending, then priority descending
        if (b.health_score !== a.health_score) {
          return b.health_score - a.health_score;
        }
        if (a.average_latency !== b.average_latency) {
          return a.average_latency - b.average_latency;
        }
        return b.priority - a.priority;
      });

      const bestModel = scoredModels[0];
      return {
        id: bestModel.id,
        name: bestModel.name,
        provider: 'NVIDIA', // Hardcoded for now, can be stored in DB
        endpoint: bestModel.endpoint,
        api_key_param: bestModel.api_key_param,
        priority: bestModel.priority,
        health_score: bestModel.health_score
      };
    } catch (error) {
      console.error('Error in model selection:', error);
      return this.getFallbackModel(roles);
    }
  }

  private calculateHealthScore(model: any): number {
    const speedWeight = 0.35;
    const availabilityWeight = 0.30;
    const domainWeight = 0.20;
    const successWeight = 0.15;

    return (
      (model.speed_score * speedWeight) +
      (model.success_rate * availabilityWeight) +
      (model.speed_score * domainWeight) +
      (model.success_rate * successWeight)
    );
  }

  private getFallbackModel(roles: string[]): ModelConfig | null {
    // If DB fails, fallback to default NVIDIA model
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

  private async checkCache(message: string): Promise<{ hash: string; response: string } | null> {
    try {
      const hash = this.generateHash(message);
      const { data, error } = await supabase
        .from('cached_responses')
        .select('hash, response')
        .eq('hash', hash)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      // Update hit count
      await supabase
        .from('cached_responses')
        .update({ hits: (data as any).hits + 1 })
        .eq('hash', hash);

      return data as { hash: string; response: string };
    } catch (error) {
      console.error('Error checking cache:', error);
      return null;
    }
  }

  private generateHash(message: string): string {
    // Simple hash function - in production use crypto
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  async updateHealth(
    modelId: string,
    latency: number,
    success: boolean,
    errorType?: string
  ): Promise<void> {
    try {
      await supabase.rpc('update_model_health', {
        p_model_id: modelId,
        p_latency: latency,
        p_success: success,
        p_error_type: errorType
      });
    } catch (error) {
      console.error('Error updating model health:', error);
    }
  }

  async cacheResponse(
    message: string,
    response: string,
    modelId: string,
    intentType: string,
    ttlHours: number = 24
  ): Promise<void> {
    try {
      const hash = this.generateHash(message);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + ttlHours);

      await supabase.from('cached_responses').upsert({
        hash,
        prompt: message,
        response,
        model_id: modelId,
        intent_type: intentType,
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      });
    } catch (error) {
      console.error('Error caching response:', error);
    }
  }

  async getModelHealth(modelId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('id', modelId)
        .single();

      if (error) {
        console.error('Error fetching model health:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching model health:', error);
      return null;
    }
  }

  async getAllModels(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('enabled', true)
        .order('priority', { ascending: false });

      if (error) {
        console.error('Error fetching models:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching models:', error);
      return [];
    }
  }

  async getModelById(modelId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('id', modelId)
        .single();

      if (error) {
        console.error('Error fetching model:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching model:', error);
      return null;
    }
  }

  async enableModel(modelId: string, enabled: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('models')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('id', modelId);

      if (error) {
        console.error('Error updating model status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating model status:', error);
      return false;
    }
  }
}

export const modelRouter = new ModelRouter();
