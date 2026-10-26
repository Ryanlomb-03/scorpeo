import { ModelInfo, ModelStatus, ModelCapabilities, TaskType, ModelRole } from '../types';

export interface ModelConfig {
  id: string;
  providerId: string;
  displayName: string;
  capabilities: ModelCapabilities;
  roles?: ModelRole[];
  priority: number;
  enabled: boolean;
  estimatedSpeed?: number;
  contextWindow?: number;
  maxTokens?: number;
  costPer1kTokens?: number;
  primaryUses?: string[];
  secondaryUses?: string[];
}

export class ModelRegistry {
  private models: Map<string, ModelInfo> = new Map();
  private modelConfigs: Map<string, ModelConfig> = new Map();
  private providerModels: Map<string, Set<string>> = new Map();

  registerModel(config: ModelConfig): void {
    const modelInfo: ModelInfo = {
      id: config.id,
      providerId: config.providerId,
      displayName: config.displayName,
      capabilities: config.capabilities,
      roles: config.roles || ['general'],
      priority: config.priority,
      enabled: config.enabled,
      estimatedSpeed: config.estimatedSpeed,
      contextWindow: config.contextWindow,
      status: 'healthy',
      maxTokens: config.maxTokens,
      primaryUses: config.primaryUses || ['general chat'],
      secondaryUses: config.secondaryUses,
      supportsVision: config.capabilities.vision,
      supportsTools: config.capabilities.toolCalling,
      supportsReasoning: config.capabilities.reasoning,
      supportsCode: config.capabilities.codeGeneration || false,
      supportsMath: config.capabilities.math || false,
      supportsImageGeneration: config.capabilities.imageGeneration || false,
      verified: false,
    };

    this.models.set(config.id, modelInfo);
    this.modelConfigs.set(config.id, config);

    // Track models by provider
    if (!this.providerModels.has(config.providerId)) {
      this.providerModels.set(config.providerId, new Set());
    }
    this.providerModels.get(config.providerId)!.add(config.id);
  }

  unregisterModel(modelId: string): void {
    const model = this.models.get(modelId);
    if (model) {
      this.providerModels.get(model.providerId)?.delete(modelId);
    }
    this.models.delete(modelId);
    this.modelConfigs.delete(modelId);
  }

  getModel(modelId: string): ModelInfo | undefined {
    return this.models.get(modelId);
  }

  getAllModels(): ModelInfo[] {
    return Array.from(this.models.values());
  }

  getEnabledModels(): ModelInfo[] {
    return this.getAllModels().filter(model => model.enabled && model.status === 'healthy');
  }

  getModelsByProvider(providerId: string): ModelInfo[] {
    const modelIds = this.providerModels.get(providerId);
    if (!modelIds) return [];
    return Array.from(modelIds)
      .map(id => this.models.get(id))
      .filter((model): model is ModelInfo => model !== undefined);
  }

  getEnabledModelsByProvider(providerId: string): ModelInfo[] {
    return this.getModelsByProvider(providerId).filter(model => 
      model.enabled && model.status === 'healthy'
    );
  }

  setModelEnabled(modelId: string, enabled: boolean): void {
    const model = this.models.get(modelId);
    if (model) {
      this.models.set(modelId, { ...model, enabled });
      const config = this.modelConfigs.get(modelId);
      if (config) {
        this.modelConfigs.set(modelId, { ...config, enabled });
      }
    }
  }

  setModelStatus(modelId: string, status: ModelStatus): void {
    const model = this.models.get(modelId);
    if (model) {
      this.models.set(modelId, { ...model, status });
    }
  }

  setModelPriority(modelId: string, priority: number): void {
    const model = this.models.get(modelId);
    if (model) {
      this.models.set(modelId, { ...model, priority });
      const config = this.modelConfigs.get(modelId);
      if (config) {
        this.modelConfigs.set(modelId, { ...config, priority });
      }
    }
  }

  getModelsByCapability(capability: keyof ModelCapabilities): ModelInfo[] {
    return this.getEnabledModels().filter(model => model.capabilities[capability]);
  }

  getModelsByTask(taskType: TaskType): ModelInfo[] {
    const capabilityRequirements: Record<TaskType, (keyof ModelCapabilities)[]> = {
      conversation: ['chat'],
      reasoning: ['chat', 'reasoning'],
      coding: ['chat', 'reasoning'],
      vision: ['chat', 'vision'],
      summarization: ['chat'],
      creative: ['chat'],
      education: ['chat', 'reasoning'],
      long_context: ['chat'],
      fast_response: ['chat'],
      math: ['chat', 'reasoning'],
      research: ['chat', 'reasoning'],
      image_generation: ['imageGeneration'],
      safety_check: ['chat'],
      classification: ['chat'],
    };

    const requiredCapabilities = capabilityRequirements[taskType] || ['chat'];
    
    return this.getEnabledModels().filter(model =>
      requiredCapabilities.every(cap => model.capabilities[cap])
    );
  }

  getBestModelForTask(taskType: TaskType): ModelInfo | null {
    const models = this.getModelsByTask(taskType);
    if (models.length === 0) return null;

    // Score models based on priority, speed, and health
    const scoredModels = models.map(model => ({
      model,
      score: this.calculateModelScore(model, taskType),
    }));

    scoredModels.sort((a, b) => b.score - a.score);
    return scoredModels[0].model;
  }

  private calculateModelScore(model: ModelInfo, taskType: TaskType): number {
    let score = 0;

    // Priority score (higher priority = higher score)
    score += model.priority * 10;

    // Speed score (faster = higher score, if available)
    if (model.estimatedSpeed) {
      score += (1000 / model.estimatedSpeed) * 5;
    }

    // Context window bonus for long context tasks
    if (taskType === 'long_context' && model.contextWindow) {
      score += Math.min(model.contextWindow / 10000, 10) * 3;
    }

    // Health status penalty
    if (model.status !== 'healthy') {
      score -= 50;
    }

    return score;
  }

  getModelsByPriority(): ModelInfo[] {
    return this.getEnabledModels().sort((a, b) => b.priority - a.priority);
  }

  rotateModelsForProvider(providerId: string): ModelInfo | null {
    const models = this.getEnabledModelsByProvider(providerId);
    if (models.length === 0) return null;

    // Weighted random selection based on priority
    const totalPriority = models.reduce((sum, model) => sum + model.priority, 0);
    let random = Math.random() * totalPriority;

    for (const model of models) {
      random -= model.priority;
      if (random <= 0) {
        return model;
      }
    }

    return models[0];
  }

  resetModelStatus(modelId: string): void {
    const model = this.models.get(modelId);
    if (model) {
      this.models.set(modelId, { ...model, status: 'healthy' });
    }
  }

  resetAllModelStatuses(): void {
    for (const [id, model] of this.models.entries()) {
      this.models.set(id, { ...model, status: 'healthy' });
    }
  }

  getModelInfo(modelId: string): ModelConfig | undefined {
    return this.modelConfigs.get(modelId);
  }

  getAllModelConfigs(): ModelConfig[] {
    return Array.from(this.modelConfigs.values());
  }

  updateModelConfig(modelId: string, updates: Partial<ModelConfig>): void {
    const config = this.modelConfigs.get(modelId);
    if (config) {
      this.modelConfigs.set(modelId, { ...config, ...updates });
      
      // Update ModelInfo if needed
      const model = this.models.get(modelId);
      if (model) {
        this.models.set(modelId, {
          ...model,
          ...(updates.enabled !== undefined && { enabled: updates.enabled }),
          ...(updates.priority !== undefined && { priority: updates.priority }),
        });
      }
    }
  }
}

export const modelRegistry = new ModelRegistry();
