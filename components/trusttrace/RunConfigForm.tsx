'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ScenarioPublic, AgentMode } from '@/lib/trusttrace/models';
import { getScenarios, createRun, TrustTraceApiError } from '@/lib/trusttrace/client';

// ============================================================
// RunConfigForm
// ============================================================

interface RunConfigFormProps {
  onRunCreated: (runId: string) => void;
}

export function RunConfigForm({ onRunCreated }: RunConfigFormProps) {
  const [scenarios, setScenarios] = useState<ScenarioPublic[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [protectionEnabled, setProtectionEnabled] = useState<boolean>(true);
  const [agentMode, setAgentMode] = useState<AgentMode>('scripted');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getScenarios()
      .then((data) => {
        if (cancelled) return;
        setScenarios(data);
        if (data.length > 0) {
          setSelectedScenarioId(data[0].id);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          err instanceof TrustTraceApiError
            ? err.message
            : 'Failed to load scenarios';
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId) ?? null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedScenarioId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createRun({
        scenario_id: selectedScenarioId,
        protection_enabled: protectionEnabled,
        agent_mode: agentMode,
      });
      onRunCreated(result.run_id);
    } catch (err: unknown) {
      const msg =
        err instanceof TrustTraceApiError ? err.message : 'Failed to start run';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-panel rounded-xl p-6 space-y-6"
    >
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Configure Run</h2>
        <p className="text-sm text-gray-400">
          Choose a scenario, protection mode, and agent type to start an evaluation.
        </p>
      </div>

      {/* Scenario selector */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300" htmlFor="scenario-select">
          Scenario
        </label>
        {loading ? (
          <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
        ) : (
          <select
            id="scenario-select"
            value={selectedScenarioId}
            onChange={(e) => setSelectedScenarioId(e.target.value)}
            disabled={loading}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}

        {/* Scenario details */}
        {selectedScenario && !loading && (
          <div className="mica-strong rounded-lg p-4 space-y-2 text-sm">
            <p className="text-gray-300">{selectedScenario.description}</p>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">
                Expected invariant
              </span>
              <p className="text-gray-400 text-xs mt-0.5">
                {selectedScenario.expected_invariant}
              </p>
            </div>
            {selectedScenario.simulated && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Simulated
              </span>
            )}
          </div>
        )}
      </div>

      {/* Protection toggle */}
      <div className="space-y-2">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={protectionEnabled}
            onChange={(e) => setProtectionEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-black/40 text-cyan-500 focus:ring-cyan-500/30"
          />
          <span className="text-sm font-medium text-gray-300">Protection Enabled</span>
        </label>
        {!protectionEnabled && (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <span className="text-amber-400 text-xs mt-0.5">⚠</span>
            <p className="text-xs text-amber-300">
              Without protection the attack will succeed — for comparison only.
            </p>
          </div>
        )}
      </div>

      {/* Agent mode */}
      <div className="space-y-3">
        <div className="text-sm font-medium text-gray-300">Agent Mode</div>
        <div className="space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="agentMode"
              value="scripted"
              checked={agentMode === 'scripted'}
              onChange={() => setAgentMode('scripted')}
              className="mt-0.5 w-4 h-4 border-gray-600 bg-black/40 text-cyan-500 focus:ring-cyan-500/30"
            />
            <div>
              <div className="text-sm text-gray-200 font-medium">
                Scripted (deterministic, ~1 s)
              </div>
              <div className="text-xs text-gray-500">
                Predefined action sequence — reproducible, instant results. Does not call Ollama.
              </div>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="agentMode"
              value="ollama"
              checked={agentMode === 'ollama'}
              onChange={() => setAgentMode('ollama')}
              className="mt-0.5 w-4 h-4 border-gray-600 bg-black/40 text-cyan-500 focus:ring-cyan-500/30"
            />
            <div>
              <div className="text-sm text-gray-200 font-medium">
                Ollama / qwen2.5:7b (real model inference, ~30 s, requires local Ollama)
              </div>
              <div className="text-xs text-gray-500">
                Live LLM-backed execution. The model decides which tools to call — results may vary.
              </div>
            </div>
          </label>
        </div>

        {agentMode === 'ollama' && (
          <div className="flex items-start gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-2">
            <span className="text-cyan-400 text-xs mt-0.5">ℹ</span>
            <p className="text-xs text-cyan-300">
              Requires Ollama running locally on port 11434 with qwen2.5:7b pulled.
            </p>
          </div>
        )}
      </div>

      {/* Submit */}
      <div>
        <button
          type="submit"
          disabled={submitting || loading || !selectedScenarioId}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
        >
          {submitting && (
            <Loader2 className="animate-spin" size={16} />
          )}
          {submitting ? 'Starting run…' : 'Start Evaluation Run'}
        </button>
        {error && (
          <p className="mt-2 text-sm text-red-400">{error}</p>
        )}
      </div>
    </form>
  );
}
