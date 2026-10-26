import { AIProvider, ProviderStatus, ProviderHealth, ProviderState } from '../types';

export interface ProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  rateLimitPerMinute?: number;
  rateLimitPerDay?: number;
  cooldownDuration?: number; // in milliseconds
}

export class ProviderRegistry {
  private providers: Map<string, AIProvider> = new Map();
  private providerStates: Map<string, ProviderState> = new Map();
  private providerConfigs: Map<string, ProviderConfig> = new Map();

  registerProvider(provider: AIProvider, config: ProviderConfig): void {
    this.providers.set(provider.id, provider);
    this.providerConfigs.set(provider.id, config);
    
    // Initialize provider state
    this.providerStates.set(provider.id, {
      requestsPerMinute: 0,
      requestsToday: 0,
      tokensUsed: 0,
      lastRequest: new Date(),
      latency: 0,
      consecutiveErrors: 0,
    });
  }

  unregisterProvider(providerId: string): void {
    this.providers.delete(providerId);
    this.providerConfigs.delete(providerId);
    this.providerStates.delete(providerId);
  }

  getProvider(providerId: string): AIProvider | undefined {
    return this.providers.get(providerId);
  }

  getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  getEnabledProviders(): AIProvider[] {
    return this.getAllProviders().filter(provider => {
      const config = this.providerConfigs.get(provider.id);
      return config?.enabled && provider.isAvailable();
    });
  }

  getProviderState(providerId: string): ProviderState | undefined {
    return this.providerStates.get(providerId);
  }

  getProviderConfig(providerId: string): ProviderConfig | undefined {
    return this.providerConfigs.get(providerId);
  }

  updateProviderState(providerId: string, updates: Partial<ProviderState>): void {
    const currentState = this.providerStates.get(providerId);
    if (currentState) {
      this.providerStates.set(providerId, { ...currentState, ...updates });
    }
  }

  setProviderEnabled(providerId: string, enabled: boolean): void {
    const config = this.providerConfigs.get(providerId);
    if (config) {
      this.providerConfigs.set(providerId, { ...config, enabled });
    }
  }

  setProviderPriority(providerId: string, priority: number): void {
    const config = this.providerConfigs.get(providerId);
    if (config) {
      this.providerConfigs.set(providerId, { ...config, priority });
    }
  }

  putProviderInCooldown(providerId: string, duration?: number): void {
    const config = this.providerConfigs.get(providerId);
    const cooldownDuration = duration || config?.cooldownDuration || 60000; // default 1 minute
    
    this.updateProviderState(providerId, {
      cooldownUntil: new Date(Date.now() + cooldownDuration),
      consecutiveErrors: (this.providerStates.get(providerId)?.consecutiveErrors || 0) + 1,
      lastError: new Date(),
    });
  }

  isProviderInCooldown(providerId: string): boolean {
    const state = this.providerStates.get(providerId);
    if (!state?.cooldownUntil) return false;
    return new Date() < state.cooldownUntil;
  }

  checkRateLimit(providerId: string): boolean {
    const state = this.providerStates.get(providerId);
    const config = this.providerConfigs.get(providerId);
    
    if (!state || !config) return false;

    // Check per-minute limit
    if (config.rateLimitPerMinute) {
      const oneMinuteAgo = new Date(Date.now() - 60000);
      if (state.lastRequest > oneMinuteAgo && state.requestsPerMinute >= config.rateLimitPerMinute) {
        return false;
      }
    }

    // Check per-day limit
    if (config.rateLimitPerDay) {
      const oneDayAgo = new Date(Date.now() - 86400000);
      if (state.lastRequest > oneDayAgo && state.requestsToday >= config.rateLimitPerDay) {
        return false;
      }
    }

    return true;
  }

  recordRequest(providerId: string, latency: number, tokensUsed: number = 0): void {
    const state = this.providerStates.get(providerId);
    if (!state) return;

    const now = new Date();
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const oneDayAgo = new Date(Date.now() - 86400000);

    // Reset counters if time has passed
    if (state.lastRequest < oneMinuteAgo) {
      state.requestsPerMinute = 0;
    }
    if (state.lastRequest < oneDayAgo) {
      state.requestsToday = 0;
    }

    this.updateProviderState(providerId, {
      requestsPerMinute: state.requestsPerMinute + 1,
      requestsToday: state.requestsToday + 1,
      tokensUsed: state.tokensUsed + tokensUsed,
      lastRequest: now,
      latency,
      consecutiveErrors: 0, // Reset on success
      cooldownUntil: undefined, // Clear cooldown on success
    });
  }

  recordError(providerId: string, error: string): void {
    const state = this.providerStates.get(providerId);
    if (!state) return;

    this.updateProviderState(providerId, {
      consecutiveErrors: state.consecutiveErrors + 1,
      lastError: new Date(),
    });

    // Auto-cooldown after multiple consecutive errors
    if (state.consecutiveErrors >= 3) {
      this.putProviderInCooldown(providerId);
    }
  }

  getProviderHealth(providerId: string): ProviderHealth {
    const provider = this.providers.get(providerId);
    const state = this.providerStates.get(providerId);
    const config = this.providerConfigs.get(providerId);

    if (!provider || !state || !config) {
      return {
        status: 'unknown',
        lastCheck: new Date(),
        consecutiveErrors: 0,
        averageLatency: 0,
      };
    }

    let status: ProviderStatus = 'healthy';
    
    if (!config.enabled) {
      status = 'disabled';
    } else if (this.isProviderInCooldown(providerId)) {
      status = 'cooldown';
    } else if (!provider.isAvailable()) {
      status = 'unknown';
    }

    return {
      status,
      lastCheck: state.lastRequest,
      consecutiveErrors: state.consecutiveErrors,
      lastError: state.lastError?.toISOString(),
      cooldownUntil: state.cooldownUntil,
      averageLatency: state.latency,
    };
  }

  getAllProviderHealth(): Map<string, ProviderHealth> {
    const healthMap = new Map<string, ProviderHealth>();
    for (const providerId of this.providers.keys()) {
      healthMap.set(providerId, this.getProviderHealth(providerId));
    }
    return healthMap;
  }

  getProvidersByPriority(): AIProvider[] {
    return this.getEnabledProviders().sort((a, b) => {
      const configA = this.providerConfigs.get(a.id);
      const configB = this.providerConfigs.get(b.id);
      const priorityA = configA?.priority || 0;
      const priorityB = configB?.priority || 0;
      return priorityB - priorityA; // Higher priority first
    });
  }

  resetProviderState(providerId: string): void {
    this.providerStates.set(providerId, {
      requestsPerMinute: 0,
      requestsToday: 0,
      tokensUsed: 0,
      lastRequest: new Date(),
      latency: 0,
      consecutiveErrors: 0,
    });
  }
}

export const providerRegistry = new ProviderRegistry();
