import {
  AIRequest,
  AIResponse,
  AIStreamChunk,
  RoutingDecision,
  RoutingLog,
  TaskType,
  ModelCapabilities,
} from '../types';
import { providerRegistry, ProviderConfig } from '../registry/provider-registry';
import { modelRegistry } from '../registry/model-registry';
import { intentClassifier, IntentResult } from '../../intentClassifier';
import { StreamEvent, StreamMetrics, ProviderPerformance, createStreamEvent, serializeStreamEvent } from '../stream';

export class AIRouter {
  private maxFallbackAttempts = 3;
  private routingLogs: RoutingLog[] = [];
  private maxLogEntries = 1000;
  private providerPerformance: Map<string, ProviderPerformance> = new Map();
  private performanceWindowMs = 5 * 60 * 1000; // 5 minute window
  private requestTimeoutMs = 30000; // 30 second timeout

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // NVIDIA
    const nvidiaApiKey = process.env.NVIDIA_API_KEY;
    if (nvidiaApiKey) {
      const { NVIDIAProvider } = require('../providers/nvidia');
      const nvidiaProvider = new NVIDIAProvider(nvidiaApiKey);
      providerRegistry.registerProvider(nvidiaProvider, {
        id: 'nvidia',
        name: 'NVIDIA NIM',
        enabled: true,
        priority: 90,
        rateLimitPerMinute: 60,
        rateLimitPerDay: 1000,
        cooldownDuration: 60000,
      });
    }

    // Groq
    const groqApiKey = process.env.GROQ_API_KEY;
    if (groqApiKey) {
      const { GroqProvider } = require('../providers/groq');
      const groqProvider = new GroqProvider(groqApiKey);
      providerRegistry.registerProvider(groqProvider, {
        id: 'groq',
        name: 'Groq',
        enabled: true,
        priority: 85,
        rateLimitPerMinute: 30,
        rateLimitPerDay: 1440,
        cooldownDuration: 30000,
      });
    }

    // Cloudflare
    const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (cloudflareAccountId && cloudflareApiToken) {
      const { CloudflareProvider } = require('../providers/cloudflare');
      const cloudflareProvider = new CloudflareProvider(cloudflareAccountId, cloudflareApiToken);
      providerRegistry.registerProvider(cloudflareProvider, {
        id: 'cloudflare',
        name: 'Cloudflare Workers AI',
        enabled: true,
        priority: 70,
        rateLimitPerMinute: 50,
        rateLimitPerDay: 10000,
        cooldownDuration: 60000,
      });
    }

    // Gemini
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      const { GeminiProvider } = require('../providers/gemini');
      const geminiProvider = new GeminiProvider(geminiApiKey);
      providerRegistry.registerProvider(geminiProvider, {
        id: 'gemini',
        name: 'Google Gemini',
        enabled: true,
        priority: 95,
        rateLimitPerMinute: 15,
        rateLimitPerDay: 1500,
        cooldownDuration: 120000,
      });
    }

    // Mistral
    const mistralApiKey = process.env.MISTRAL_API_KEY;
    if (mistralApiKey) {
      const { MistralProvider } = require('../providers/mistral');
      const mistralProvider = new MistralProvider(mistralApiKey);
      providerRegistry.registerProvider(mistralProvider, {
        id: 'mistral',
        name: 'Mistral AI',
        enabled: true,
        priority: 88,
        rateLimitPerMinute: 20,
        rateLimitPerDay: 2000,
        cooldownDuration: 60000,
      });
    }

    // OpenRouter
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    if (openrouterApiKey) {
      const { OpenRouterProvider } = require('../providers/openrouter');
      const openrouterProvider = new OpenRouterProvider(openrouterApiKey);
      providerRegistry.registerProvider(openrouterProvider, {
        id: 'openrouter',
        name: 'OpenRouter',
        enabled: true,
        priority: 50,
        rateLimitPerMinute: 20,
        rateLimitPerDay: 200,
        cooldownDuration: 60000,
      });
    }

    // Register models from all providers
    this.registerModels();
  }

  private async registerModels(): Promise<void> {
    const providers = providerRegistry.getAllProviders();
    
    for (const provider of providers) {
      try {
        const models = await provider.listModels();
        for (const model of models) {
          modelRegistry.registerModel({
            id: model.id,
            providerId: model.providerId,
            displayName: model.displayName,
            capabilities: model.capabilities,
            priority: model.priority,
            enabled: model.enabled,
            estimatedSpeed: model.estimatedSpeed,
            contextWindow: model.contextWindow,
            maxTokens: model.maxTokens,
          });
        }
      } catch (error) {
        console.error(`Failed to register models for provider ${provider.id}:`, error);
      }
    }
  }

  private classifyTask(message: string): TaskType {
    const intent = intentClassifier.classify(message);
    
    const taskMapping: Record<string, TaskType> = {
      'greeting': 'conversation',
      'chat': 'conversation',
      'generate_code': 'coding',
      'debug_code': 'coding',
      'explain_code': 'education',
      'math': 'math',
      'research': 'research',
      'creative': 'creative',
      'fallback': 'conversation',
    };

    return taskMapping[intent.type] || 'conversation';
  }

  private determineRequiredCapabilities(request: AIRequest): Partial<ModelCapabilities> {
    const capabilities: Partial<ModelCapabilities> = {
      chat: true,
      streaming: request.stream !== false,
    };

    // Check for vision requirements
    const hasImage = request.messages.some(msg => {
      if (typeof msg.content === 'string') return false;
      if (Array.isArray(msg.content)) {
        return msg.content.some(item => item.type === 'image_url');
      }
      return false;
    });

    if (hasImage) {
      capabilities.vision = true;
    }

    // Check for tool calling requirements
    if (request.tools && request.tools.length > 0) {
      capabilities.toolCalling = true;
    }

    // Infer reasoning requirements from task type
    const reasoningTasks: TaskType[] = ['reasoning', 'coding', 'math', 'research', 'education'];
    if (reasoningTasks.includes(request.taskType)) {
      capabilities.reasoning = true;
    }

    return capabilities;
  }

  private selectBestProvider(request: AIRequest): RoutingDecision {
    const taskType = request.taskType;
    const capabilities = this.determineRequiredCapabilities(request);
    const now = Date.now();
    
    // Get providers that support the task - NO health checks, just capability filtering
    const providers = providerRegistry.getProvidersByPriority().filter(provider => {
      if (!provider.isAvailable()) return false;
      if (!provider.supportsTask(taskType)) return false;
      
      const providerCaps = provider.getCapabilities();
      
      // Check capability requirements
      if (capabilities.vision && !providerCaps.vision) return false;
      if (capabilities.toolCalling && !providerCaps.toolCalling) return false;
      if (capabilities.reasoning && !providerCaps.reasoning) return false;
      
      // Check cooldown from performance history
      const perf = this.providerPerformance.get(provider.id);
      if (perf?.cooldownUntil && perf.cooldownUntil > now) {
        return false;
      }
      
      return true;
    });

    if (providers.length === 0) {
      throw new Error('No available providers support the required capabilities');
    }

    // Score providers based on lightweight runtime state
    const scoredProviders = providers.map(provider => {
      const providerId = provider.id;
      const config = providerRegistry.getProviderConfig(providerId);
      const perf = this.providerPerformance.get(providerId);
      
      let score = 0;

      // Priority score
      score += (config?.priority || 0) * 10;

      // Performance-based scoring
      if (perf) {
        // Success rate bonus
        score += perf.successRate * 30;
        
        // TTFT bonus (lower is better)
        if (perf.averageTTFT > 0) {
          score += Math.max(0, 2000 - perf.averageTTFT) / 20;
        }
        
        // Latency bonus (lower is better)
        if (perf.averageLatency > 0) {
          score += Math.max(0, 1500 - perf.averageLatency) / 15;
        }
        
        // Recent errors penalty
        score -= perf.recentErrors * 15;
        score -= perf.recent429s * 25;
      } else {
        // No performance data yet - give neutral score
        score += 20;
      }

      return {
        provider,
        score,
      };
    });

    scoredProviders.sort((a, b) => b.score - a.score);

    const selectedProvider = scoredProviders[0].provider;
    const selectedModel = modelRegistry.getBestModelForTask(taskType) || 
                         modelRegistry.rotateModelsForProvider(selectedProvider.id);

    if (!selectedModel) {
      throw new Error('No available models for the selected provider');
    }

    return {
      providerId: selectedProvider.id,
      modelId: selectedModel.id,
      reason: `highest_score_${scoredProviders[0].score}`,
      score: scoredProviders[0].score,
      fallbackAttempts: 0,
      estimatedLatency: this.providerPerformance.get(selectedProvider.id)?.averageLatency,
    };
  }

  /**
   * Record provider performance metrics
   */
  private recordPerformance(providerId: string, modelId: string, metrics: Partial<StreamMetrics>): void {
    const now = Date.now();
    const existing = this.providerPerformance.get(providerId);
    
    if (existing) {
      // Decay old performance data
      const age = now - existing.lastRequest;
      const decayFactor = Math.max(0, 1 - age / this.performanceWindowMs);
      
      // Update with exponential moving average
      if (metrics.timeToFirstToken !== undefined) {
        existing.averageTTFT = existing.averageTTFT * decayFactor + metrics.timeToFirstToken * (1 - decayFactor);
      }
      if (metrics.totalGenerationTime !== undefined) {
        existing.averageLatency = existing.averageLatency * decayFactor + metrics.totalGenerationTime * (1 - decayFactor);
      }
      if (metrics.tokensPerSecond !== undefined) {
        existing.tokensPerSecond = existing.tokensPerSecond * decayFactor + metrics.tokensPerSecond * (1 - decayFactor);
      }
      
      existing.lastRequest = now;
      existing.lastSuccess = metrics.generationCompleted !== undefined ? metrics.generationCompleted : existing.lastSuccess;
      
      // Update success rate
      if (metrics.generationCompleted !== undefined) {
        existing.successRate = existing.successRate * decayFactor + 1 * (1 - decayFactor);
      }
    } else {
      // Initialize new performance record
      this.providerPerformance.set(providerId, {
        providerId,
        modelId,
        averageLatency: metrics.totalGenerationTime || 0,
        averageTTFT: metrics.timeToFirstToken || 0,
        tokensPerSecond: metrics.tokensPerSecond || 0,
        recentErrors: 0,
        recent429s: 0,
        successRate: 1,
        lastRequest: now,
        lastSuccess: metrics.generationCompleted || now,
        lastError: 0,
      });
    }
  }

  /**
   * Record provider error
   */
  private recordProviderError(providerId: string, errorCode?: string): void {
    const existing = this.providerPerformance.get(providerId);
    const now = Date.now();
    
    if (existing) {
      existing.recentErrors++;
      existing.lastError = now;
      
      if (errorCode === '429' || errorCode === 'RATE_LIMITED') {
        existing.recent429s++;
        // Set cooldown for rate limits
        existing.cooldownUntil = now + 60000; // 1 minute cooldown
      }
    } else {
      this.providerPerformance.set(providerId, {
        providerId,
        modelId: 'unknown',
        averageLatency: 0,
        averageTTFT: 0,
        tokensPerSecond: 0,
        recentErrors: 1,
        recent429s: errorCode === '429' || errorCode === 'RATE_LIMITED' ? 1 : 0,
        successRate: 0,
        lastRequest: now,
        lastSuccess: 0,
        lastError: now,
        cooldownUntil: errorCode === '429' || errorCode === 'RATE_LIMITED' ? now + 60000 : undefined,
      });
    }
  }

  /**
   * Get provider performance data
   */
  getProviderPerformance(providerId: string): ProviderPerformance | undefined {
    return this.providerPerformance.get(providerId);
  }

  /**
   * Get all provider performance data
   */
  getAllProviderPerformance(): Map<string, ProviderPerformance> {
    return new Map(this.providerPerformance);
  }

  async route(request: AIRequest): Promise<RoutingDecision> {
    const decision = this.selectBestProvider(request);
    return decision;
  }

  async *streamRoute(request: AIRequest): AsyncIterable<AIStreamChunk> {
    const requestId = this.generateRequestId();
    const requestStarted = Date.now();
    let fallbackAttempts = 0;
    let lastError: string | undefined;
    let currentMetrics: Partial<StreamMetrics> = {
      requestStarted,
    };

    while (fallbackAttempts < this.maxFallbackAttempts) {
      try {
        const routingCompleted = Date.now();
        currentMetrics.routingCompleted = routingCompleted;
        currentMetrics.routingLatency = routingCompleted - requestStarted;

        const decision = await this.route(request);
        const provider = providerRegistry.getProvider(decision.providerId);
        
        if (!provider) {
          throw new Error(`Provider ${decision.providerId} not found`);
        }

        const providerRequestStarted = Date.now();
        currentMetrics.providerRequestStarted = providerRequestStarted;

        // Create abort controller for timeout
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => {
          abortController.abort();
        }, this.requestTimeoutMs);

        let success = false;
        let tokensUsed = 0;
        let firstTokenReceived: number | undefined;
        let totalTokens = 0;

        try {
          for await (const chunk of provider.stream(request)) {
            if (chunk.type === 'error') {
              throw new Error(chunk.error);
            }
            if (chunk.type === 'done') {
              success = true;
              currentMetrics.generationCompleted = Date.now();
              currentMetrics.totalGenerationTime = currentMetrics.generationCompleted - providerRequestStarted;
              
              if (totalTokens > 0 && currentMetrics.totalGenerationTime > 0) {
                currentMetrics.tokensPerSecond = (totalTokens / currentMetrics.totalGenerationTime) * 1000;
              }
            }
            
            // Track first token
            if (!firstTokenReceived && chunk.type === 'text' && chunk.content) {
              firstTokenReceived = Date.now();
              currentMetrics.firstTokenReceived = firstTokenReceived;
              currentMetrics.timeToFirstToken = firstTokenReceived - providerRequestStarted;
            }
            
            // Count tokens (rough estimate)
            if (chunk.type === 'text' && chunk.content) {
              totalTokens += chunk.content.length / 4; // Rough token estimate
            }
            
            yield chunk;
          }

          clearTimeout(timeoutId);

          // Record performance
          this.recordPerformance(decision.providerId, decision.modelId, currentMetrics);

          this.logRouting({
            requestId,
            task: request.taskType,
            selectedProvider: decision.providerId,
            selectedModel: decision.modelId,
            reason: decision.reason,
            fallbackAttempts,
            latencyMs: currentMetrics.totalGenerationTime || 0,
            status: 'success',
            timestamp: new Date(),
          });

          return;
        } catch (error) {
          clearTimeout(timeoutId);
          
          const errorMessage = error instanceof Error ? error.message : String(error);
          lastError = errorMessage;
          
          // Check if it was a timeout
          if (error instanceof Error && error.name === 'AbortError') {
            this.recordProviderError(decision.providerId, 'TIMEOUT');
            lastError = 'Request timeout';
          } else if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
            this.recordProviderError(decision.providerId, '429');
          } else {
            this.recordProviderError(decision.providerId);
          }
          
          fallbackAttempts++;
          
          yield {
            type: 'error',
            error: `Provider ${decision.providerId} failed: ${errorMessage}. Attempting fallback ${fallbackAttempts}/${this.maxFallbackAttempts}`,
          };

          // Continue to next iteration for fallback
          continue;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        fallbackAttempts++;
        
        if (fallbackAttempts >= this.maxFallbackAttempts) {
          this.logRouting({
            requestId,
            task: request.taskType,
            selectedProvider: 'none',
            selectedModel: 'none',
            reason: 'all_providers_failed',
            fallbackAttempts,
            status: 'failure',
            timestamp: new Date(),
          });
          
          yield {
            type: 'error',
            error: `All providers failed after ${fallbackAttempts} attempts. Last error: ${lastError}`,
          };
          return;
        }
      }
    }
  }

  async chatRoute(request: AIRequest): Promise<AIResponse> {
    const requestId = this.generateRequestId();
    let fallbackAttempts = 0;
    let lastError: string | undefined;

    while (fallbackAttempts < this.maxFallbackAttempts) {
      try {
        const decision = await this.route(request);
        const provider = providerRegistry.getProvider(decision.providerId);
        
        if (!provider) {
          throw new Error(`Provider ${decision.providerId} not found`);
        }

        const startTime = Date.now();
        
        try {
          const response = await provider.chat(request);
          const latency = Date.now() - startTime;
          
          providerRegistry.recordRequest(
            decision.providerId,
            latency,
            response.usage?.totalTokens || 0
          );

          this.logRouting({
            requestId,
            task: request.taskType,
            selectedProvider: decision.providerId,
            selectedModel: decision.modelId,
            reason: decision.reason,
            fallbackAttempts,
            latencyMs: latency,
            status: 'success',
            timestamp: new Date(),
          });

          return response;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          lastError = errorMessage;
          
          providerRegistry.recordError(decision.providerId, errorMessage);
          providerRegistry.putProviderInCooldown(decision.providerId);

          fallbackAttempts++;
          continue;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        fallbackAttempts++;
        
        if (fallbackAttempts >= this.maxFallbackAttempts) {
          this.logRouting({
            requestId,
            task: request.taskType,
            selectedProvider: 'none',
            selectedModel: 'none',
            reason: 'all_providers_failed',
            fallbackAttempts,
            status: 'failure',
            timestamp: new Date(),
          });
          
          throw new Error(`All providers failed after ${fallbackAttempts} attempts. Last error: ${lastError}`);
        }
      }
    }

    throw new Error('Max fallback attempts exceeded');
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logRouting(log: RoutingLog): void {
    this.routingLogs.push(log);
    
    // Keep log size manageable
    if (this.routingLogs.length > this.maxLogEntries) {
      this.routingLogs = this.routingLogs.slice(-this.maxLogEntries);
    }

    // Console log for debugging (in production, this would go to a proper logging system)
    console.log('[AI Router]', {
      requestId: log.requestId,
      task: log.task,
      provider: log.selectedProvider,
      model: log.selectedModel,
      reason: log.reason,
      fallbacks: log.fallbackAttempts,
      latency: log.latencyMs,
      status: log.status,
    });
  }

  getRoutingLogs(): RoutingLog[] {
    return [...this.routingLogs];
  }

  getProviderStatus() {
    const providers = providerRegistry.getAllProviders();
    return providers.map(provider => {
      const health = providerRegistry.getProviderHealth(provider.id);
      const state = providerRegistry.getProviderState(provider.id);
      return {
        id: provider.id,
        name: provider.name,
        status: health.status,
        latency: state?.latency || 0,
        consecutiveErrors: state?.consecutiveErrors || 0,
        lastRequest: state?.lastRequest,
        cooldownUntil: health.cooldownUntil,
      };
    });
  }

  getModelStatus() {
    return modelRegistry.getAllModels();
  }
}

export const aiRouter = new AIRouter();
