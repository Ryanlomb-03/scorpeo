import { NextRequest, NextResponse } from 'next/server';
import { providerRegistry } from '../../../lib/ai/registry/provider-registry';
import { modelRegistry } from '../../../lib/ai/registry/model-registry';

// Check if debug mode is enabled
const DEBUG_ENABLED = process.env.SCORPEO_AI_DEBUG_SELECTOR === 'true';

export async function GET(req: NextRequest) {
  if (!DEBUG_ENABLED) {
    return NextResponse.json({ error: 'Debug mode not enabled' }, { status: 403 });
  }

  try {
    // Get provider status
    const providers = providerRegistry.getAllProviders();
    const providerStatus = providers.map(provider => {
      const health = providerRegistry.getProviderHealth(provider.id);
      const config = providerRegistry.getProviderConfig(provider.id);
      const state = providerRegistry.getProviderState(provider.id);
      
      return {
        id: provider.id,
        name: provider.name,
        status: health.status,
        isAvailable: provider.isAvailable(),
        priority: config?.priority || 0,
        latency: state?.latency || 0,
        consecutiveErrors: state?.consecutiveErrors || 0,
        lastRequest: state?.lastRequest,
        cooldownUntil: health.cooldownUntil,
        enabled: config?.enabled || false,
      };
    });

    // Get model status
    const models = modelRegistry.getAllModels();

    return NextResponse.json({
      providers: providerStatus,
      models: models,
      debugMode: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get debug information', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!DEBUG_ENABLED) {
    return NextResponse.json({ error: 'Debug mode not enabled' }, { status: 403 });
  }

  try {
    const { providerId, modelId, message, manualMode } = await req.json();

    if (!providerId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: providerId, message' },
        { status: 400 }
      );
    }

    const provider = providerRegistry.getProvider(providerId);
    if (!provider) {
      return NextResponse.json(
        { error: `Provider ${providerId} not found` },
        { status: 404 }
      );
    }

    const startTime = Date.now();
    let success = false;
    let error: string | undefined;
    let latency = 0;

    try {
      // Test the provider with a simple request
      const aiRequest = {
        messages: [
          { role: 'system' as const, content: 'You are a helpful assistant.' },
          { role: 'user' as const, content: message },
        ],
        taskType: 'conversation' as any,
        capabilities: { chat: true, streaming: false },
        stream: false,
      };

      const response = await provider.chat(aiRequest);
      latency = Date.now() - startTime;
      success = true;

      // Only record request/error if not in manual mode
      if (!manualMode) {
        providerRegistry.recordRequest(providerId, latency, response.usage?.totalTokens || 0);
      }

      return NextResponse.json({
        success: true,
        providerId,
        modelId: modelId || 'default',
        response: response.content,
        usage: response.usage,
        latency,
        streaming: false,
      });
    } catch (err) {
      latency = Date.now() - startTime;
      error = err instanceof Error ? err.message : String(err);
      
      // Only record error if not in manual mode
      if (!manualMode) {
        providerRegistry.recordError(providerId, error);
      }

      return NextResponse.json({
        success: false,
        providerId,
        modelId: modelId || 'default',
        error,
        latency,
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to test provider', details: String(error) },
      { status: 500 }
    );
  }
}
