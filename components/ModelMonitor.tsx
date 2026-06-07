"use client";

import { useEffect, useState } from "react";

interface Model {
  id: string;
  name: string;
  provider: string;
  priority: number;
  speed_score: number;
  coding_score: number;
  math_score: number;
  reasoning_score: number;
  creative_score: number;
  status: string;
  average_latency: number;
  success_rate: number;
  total_requests: number;
  enabled: boolean;
  last_checked: string;
}

export default function ModelMonitor() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchModels();
    const interval = setInterval(fetchModels, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/models');
      const data = await response.json();
      setModels(data.models || []);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch model data');
      setLoading(false);
    }
  };

  const toggleModel = async (modelId: string, currentEnabled: boolean) => {
    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId, enabled: !currentEnabled })
      });

      if (response.ok) {
        await fetchModels();
      }
    } catch (err) {
      console.error('Failed to toggle model:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'degraded': return 'text-yellow-400';
      case 'offline': return 'text-red-400';
      case 'disabled': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getHealthScore = (model: Model) => {
    const speedWeight = 0.35;
    const availabilityWeight = 0.30;
    const domainWeight = 0.20;
    const successWeight = 0.15;

    // Simplified domain score (average of all capability scores)
    const domainScore = (
      model.speed_score + 
      model.coding_score + 
      model.math_score + 
      model.reasoning_score + 
      model.creative_score
    ) / 5;

    return (
      (model.speed_score * speedWeight) +
      (model.success_rate * availabilityWeight) +
      (domainScore * domainWeight) +
      (model.success_rate * successWeight)
    ).toFixed(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Loading model data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-neutral-900 rounded-lg">
      <h2 className="text-2xl font-bold mb-6 text-white">AI Model Monitor</h2>
      
      <div className="space-y-4">
        {models.map((model) => (
          <div
            key={model.id}
            className={`p-4 rounded-lg border ${
              model.enabled 
                ? 'border-neutral-700 bg-neutral-800' 
                : 'border-neutral-800 bg-neutral-900 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{model.name}</h3>
                <p className="text-sm text-gray-400">{model.provider} • Priority: {model.priority}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className={`text-sm font-medium ${getStatusColor(model.status)}`}>
                  {model.status}
                </span>
                <button
                  onClick={() => toggleModel(model.id, model.enabled)}
                  className={`px-3 py-1 rounded text-sm ${
                    model.enabled
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-600 hover:bg-gray-700 text-white'
                  }`}
                >
                  {model.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Health Score</p>
                <p className="text-white font-medium">{getHealthScore(model)}</p>
              </div>
              <div>
                <p className="text-gray-500">Avg Latency</p>
                <p className="text-white font-medium">{model.average_latency || 0}ms</p>
              </div>
              <div>
                <p className="text-gray-500">Success Rate</p>
                <p className="text-white font-medium">{model.success_rate.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-gray-500">Total Requests</p>
                <p className="text-white font-medium">{model.total_requests}</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-5 gap-2 text-xs">
              <div>
                <p className="text-gray-500">Speed</p>
                <p className="text-white">{model.speed_score}</p>
              </div>
              <div>
                <p className="text-gray-500">Coding</p>
                <p className="text-white">{model.coding_score}</p>
              </div>
              <div>
                <p className="text-gray-500">Math</p>
                <p className="text-white">{model.math_score}</p>
              </div>
              <div>
                <p className="text-gray-500">Reasoning</p>
                <p className="text-white">{model.reasoning_score}</p>
              </div>
              <div>
                <p className="text-gray-500">Creative</p>
                <p className="text-white">{model.creative_score}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}