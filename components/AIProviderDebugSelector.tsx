"use client";

import { useState, useEffect } from "react";

interface ProviderStatus {
  id: string;
  name: string;
  status: string;
  isAvailable: boolean;
  priority: number;
  latency: number;
  consecutiveErrors: number;
  enabled: boolean;
}

interface ModelInfo {
  id: string;
  providerId: string;
  displayName: string;
  enabled: boolean;
  status: string;
  roles: string[];
  verified?: boolean;
  primaryUses: string[];
  capabilities: {
    chat: boolean;
    streaming: boolean;
    vision: boolean;
    toolCalling: boolean;
    reasoning: boolean;
    embeddings: boolean;
    imageGeneration: boolean;
    codeGeneration: boolean;
    math: boolean;
    longContext: boolean;
  };
}

interface TestResult {
  success: boolean;
  providerId: string;
  modelId: string;
  response?: string;
  error?: string;
  latency: number;
  streaming: boolean;
}

export default function AIProviderDebugSelector() {
  const [debugMode, setDebugMode] = useState(false);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("automatic");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [testMessage, setTestMessage] = useState("Hello, this is a test message.");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if debug mode is enabled
    const checkDebugMode = async () => {
      try {
        const response = await fetch("/api/ai-debug");
        if (response.ok) {
          const data = await response.json();
          setDebugMode(data.debugMode);
          setProviders(data.providers);
          setModels(data.models);
        } else if (response.status === 403) {
          setDebugMode(false);
        }
      } catch (error) {
        console.error("Failed to check debug mode:", error);
      }
    };

    checkDebugMode();
  }, []);

  const handleTest = async () => {
    if (selectedProvider === "automatic") {
      setTestResult({
        success: false,
        providerId: "automatic",
        modelId: "automatic",
        error: "Cannot test automatic mode. Select a specific provider.",
        latency: 0,
        streaming: false,
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/ai-debug", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          providerId: selectedProvider,
          modelId: selectedModel,
          message: testMessage,
          manualMode: true, // Disable automatic fallback
        }),
      });

      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({
        success: false,
        providerId: selectedProvider,
        modelId: selectedModel,
        error: error instanceof Error ? error.message : "Unknown error",
        latency: 0,
        streaming: false,
      });
    } finally {
      setTesting(false);
    }
  };

  const refreshStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/ai-debug");
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers);
        setModels(data.models);
      }
    } catch (error) {
      console.error("Failed to refresh status:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!debugMode) {
    return null;
  }

  const availableModels = selectedProvider === "automatic" 
    ? models 
    : models.filter(m => m.providerId === selectedProvider);

  const selectedModelData = models.find(m => m.id === selectedModel);

  const getStatusIcon = (status: string, isAvailable: boolean, verified?: boolean) => {
    if (!isAvailable) return "○";
    if (verified) return "●";
    if (status === "healthy") return "●";
    if (status === "cooldown") return "◐";
    return "○";
  };

  const getStatusColor = (status: string, isAvailable: boolean, verified?: boolean) => {
    if (!isAvailable) return "text-gray-400";
    if (verified) return "text-green-500";
    if (status === "healthy") return "text-green-400";
    if (status === "cooldown") return "text-yellow-500";
    return "text-red-500";
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      general: "bg-blue-900/30 text-blue-300",
      fast: "bg-green-900/30 text-green-300",
      reasoning: "bg-purple-900/30 text-purple-300",
      coding: "bg-cyan-900/30 text-cyan-300",
      math: "bg-orange-900/30 text-orange-300",
      education: "bg-yellow-900/30 text-yellow-300",
      research: "bg-pink-900/30 text-pink-300",
      long_context: "bg-indigo-900/30 text-indigo-300",
      vision: "bg-teal-900/30 text-teal-300",
      image_generation: "bg-rose-900/30 text-rose-300",
      tool_use: "bg-amber-900/30 text-amber-300",
      agentic: "bg-red-900/30 text-red-300",
      safety: "bg-gray-900/30 text-gray-300",
      classification: "bg-slate-900/30 text-slate-300",
      summarization: "bg-lime-900/30 text-lime-300",
    };
    return colors[role] || "bg-neutral-800 text-neutral-300";
  };

  return (
    <div className="fixed top-20 right-4 w-96 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl z-50 max-h-[90vh] overflow-y-auto">
      <div className="p-4 border-b border-neutral-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Scorpeo AI Test Mode</h3>
          <button
            onClick={refreshStatus}
            disabled={loading}
            className="text-xs text-neutral-400 hover:text-white disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="text-xs text-neutral-400 block mb-1">Provider</label>
            <select
              value={selectedProvider}
              onChange={(e) => {
                setSelectedProvider(e.target.value);
                setSelectedModel("");
              }}
              className="w-full bg-neutral-800 text-white text-sm rounded px-3 py-2 border border-neutral-700 focus:border-neutral-600 outline-none"
            >
              <option value="automatic">Automatic</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>

          {selectedProvider !== "automatic" && (
            <>
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-neutral-800 text-white text-sm rounded px-3 py-2 border border-neutral-700 focus:border-neutral-600 outline-none"
                >
                  <option value="">Select a model...</option>
                  {availableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.displayName}
                    </option>
                  ))}
                </select>
              </div>

              {selectedModelData && (
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Roles</label>
                  <div className="flex flex-wrap gap-1">
                    {selectedModelData.roles.map((role) => (
                      <span
                        key={role}
                        className={`text-xs px-2 py-0.5 rounded ${getRoleBadge(role)}`}
                      >
                        {role.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedModelData && (
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Status</label>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={getStatusColor(selectedModelData.status, selectedModelData.enabled, selectedModelData.verified)}>
                      {getStatusIcon(selectedModelData.status, selectedModelData.enabled, selectedModelData.verified)}
                    </span>
                    <span className="text-neutral-300">
                      {selectedModelData.verified ? 'Verified' : selectedModelData.enabled ? 'Configured' : 'Not configured'}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Test Message</label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full bg-neutral-800 text-white text-sm rounded px-3 py-2 border border-neutral-700 focus:border-neutral-600 outline-none resize-none"
                  rows={2}
                />
              </div>

              <button
                onClick={handleTest}
                disabled={testing || !selectedModel}
                className="w-full bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? "Testing..." : "Test Model"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-4 border-b border-neutral-800">
        <h4 className="text-xs font-semibold text-neutral-400 mb-2">Provider Status</h4>
        <div className="space-y-1">
          {providers.map((provider) => (
            <div key={provider.id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={getStatusColor(provider.status, provider.isAvailable)}>
                  {getStatusIcon(provider.status, provider.isAvailable)}
                </span>
                <span className="text-neutral-300">{provider.name}</span>
              </div>
              <div className="flex items-center gap-3 text-neutral-500">
                {provider.isAvailable && provider.status === "healthy" && (
                  <span>{provider.latency}ms</span>
                )}
                {provider.consecutiveErrors > 0 && (
                  <span className="text-red-400">{provider.consecutiveErrors} errs</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4">
        <h4 className="text-xs font-semibold text-neutral-400 mb-2">Available Models</h4>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {models.map((model) => (
            <div key={model.id} className="flex items-center justify-between text-xs p-1 hover:bg-neutral-800 rounded">
              <div className="flex items-center gap-2">
                <span className={getStatusColor(model.status, model.enabled, model.verified)}>
                  {getStatusIcon(model.status, model.enabled, model.verified)}
                </span>
                <span className="text-neutral-300">{model.displayName}</span>
              </div>
              <div className="flex items-center gap-2">
                {model.roles.slice(0, 2).map((role) => (
                  <span
                    key={role}
                    className={`text-xs px-1.5 py-0.5 rounded ${getRoleBadge(role)}`}
                  >
                    {role.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {testResult && (
        <div className="p-4 border-t border-neutral-800">
          <h4 className="text-xs font-semibold text-neutral-400 mb-2">Test Result</h4>
          <div className={`text-xs p-3 rounded ${
            testResult.success 
              ? "bg-green-900/20 border border-green-800" 
              : "bg-red-900/20 border border-red-800"
          }`}>
            {testResult.success ? (
              <div>
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <span>●</span>
                  <span className="font-semibold">SUCCESS</span>
                </div>
                <div className="space-y-1 text-neutral-300">
                  <div>Provider: {testResult.providerId}</div>
                  <div>Model: {testResult.modelId}</div>
                  <div>Latency: {testResult.latency}ms</div>
                  <div>Streaming: {testResult.streaming ? "✓" : "✗"}</div>
                  {testResult.response && (
                    <div className="mt-2 p-2 bg-neutral-800 rounded max-h-48 overflow-y-auto">
                      <div className="text-neutral-400 mb-1">Response:</div>
                      <div className="text-neutral-200 whitespace-pre-wrap">{testResult.response}</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 text-red-400 mb-2">
                  <span>✗</span>
                  <span className="font-semibold">FAILED</span>
                </div>
                <div className="space-y-1 text-neutral-300">
                  <div>Provider: {testResult.providerId}</div>
                  <div>Model: {testResult.modelId}</div>
                  <div>Error: {testResult.error}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
