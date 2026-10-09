'use client';

import { useEffect, useState } from 'react';
import { PlayCircle, Lock, Unlock } from 'lucide-react';
import { getHealth, type HealthResponse } from '@/lib/trusttrace/client';
import type { RunStatus, Evaluation, AgentMode } from '@/lib/trusttrace/models';
import { StatusBadge } from '@/components/trusttrace/StatusBadge';

// ============================================================
// Types
// ============================================================

export interface RecentRunEntry {
  run_id: string;
  scenario_id: string;
  agent_mode: AgentMode;
  protection_enabled: boolean;
  status: RunStatus;
  evaluation: Evaluation | null;
  created_at: string;
}

// ============================================================
// OverviewPanel
// ============================================================

interface OverviewPanelProps {
  onStartRun: () => void;
  recentRuns: RecentRunEntry[];
}

export function OverviewPanel({ onStartRun, recentRuns }: OverviewPanelProps) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then((data) => {
        if (cancelled) return;
        setHealth(data);
        setHealthLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setHealthError(err instanceof Error ? err.message : 'Health check failed');
        setHealthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-cyan-300 to-violet-400 bg-clip-text text-transparent leading-tight">
          DevSentinel TrustTrace
        </h2>
        <p className="text-gray-400 mt-2 text-sm">
          Observe the attempt. Enforce the boundary. Prove the outcome.
        </p>
        <p className="text-gray-600 text-xs mt-2 max-w-2xl leading-relaxed">
          TrustTrace evaluates whether untrusted repository content can influence a tool-using AI coding
          agent to request unauthorized actions, and whether a deterministic policy layer actually
          prevents those actions. Verdicts derive from actual tool outcomes — not model reasoning.
        </p>
      </div>

      {/* Health card */}
      <div className="mica-strong rounded-xl p-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Backend Status
        </div>
        {healthLoading && (
          <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
        )}
        {healthError && !healthLoading && (
          <p className="text-sm text-red-400">{healthError}</p>
        )}
        {health && !healthLoading && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge status={health.status} />
              <span className="text-xs text-gray-400 font-mono">{health.module} v{health.version}</span>
              <div className="flex gap-2">
                {health.capabilities.scripted && (
                  <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full px-2 py-0.5">
                    scripted
                  </span>
                )}
                {health.capabilities.ollama && (
                  <span className="text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-full px-2 py-0.5">
                    ollama
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap border-t border-white/5 pt-3">
              <span className="text-xs text-gray-500">Ollama</span>
              <StatusBadge status={health.ollama.reachable ? 'ok' : 'error'} />
              <span className="text-xs font-mono text-gray-400">{health.ollama.model}</span>
              <span className="text-xs text-gray-600">{health.ollama.base_url}</span>
              {health.ollama.error && (
                <span className="text-xs text-red-400">{health.ollama.error}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Available scenarios note */}
      <div className="mica-strong rounded-xl p-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Available Scenarios
        </div>
        <p className="text-sm text-gray-300">
          Run <span className="font-mono text-cyan-400">repo-injection</span> (attack scenario) or{' '}
          <span className="font-mono text-cyan-400">benign-task</span> (baseline) to evaluate the
          policy boundary.
        </p>
      </div>

      {/* Recent runs section */}
      <div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Recent Runs
        </div>
        {recentRuns.length === 0 ? (
          <div className="glass-panel rounded-xl p-6 text-center text-gray-500 text-sm">
            No runs yet.
          </div>
        ) : (
          <div className="mica-strong rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Run ID</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Scenario</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Mode</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Protection</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Verdict</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Started</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.run_id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-gray-400 w-20 block truncate" title={run.run_id}>
                        {run.run_id.slice(0, 8)}…
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-300">{run.scenario_id}</td>
                    <td className="px-4 py-2.5">
                      <span className="bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-full px-2 py-0.5">
                        {run.agent_mode}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {run.protection_enabled ? (
                        <Lock size={13} className="text-cyan-400" />
                      ) : (
                        <Unlock size={13} className="text-red-400" />
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      {run.evaluation ? (
                        <StatusBadge status={run.evaluation.verdict} />
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 font-mono">
                      {new Date(run.created_at).toLocaleTimeString('en-US', {
                        hour12: false,
                        timeStyle: 'medium',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CTA button */}
      <div>
        <button
          onClick={onStartRun}
          className="px-6 py-3 bg-brand-primary hover:bg-brand-primary/80 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
        >
          <PlayCircle className="h-5 w-5" />
          Start a Run
        </button>
      </div>
    </div>
  );
}
