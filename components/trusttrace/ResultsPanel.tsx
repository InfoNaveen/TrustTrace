'use client';

import { useState } from 'react';
import { Lock, Unlock, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
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
// ResultsPanel
// ============================================================

interface ResultsPanelProps {
  runs: RecentRunEntry[];
}

function ChecksSummary({ evaluation }: { evaluation: Evaluation }) {
  const passed = evaluation.checks.filter((c) => c.result === 'passed').length;
  const total = evaluation.checks.length;
  return (
    <span className="text-xs text-gray-500">
      {passed} / {total} checks passed
    </span>
  );
}

function RunResultCard({
  run,
  expanded,
  onToggle,
}: {
  run: RecentRunEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const eval_ = run.evaluation!; // only rendered for completed runs with evaluation

  return (
    <div className="mica-strong rounded-xl p-4 mb-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <StatusBadge status={eval_.verdict} size="md" />
          <span className="text-xs font-mono text-gray-400">{run.scenario_id}</span>
          <span className="text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-full px-2 py-0.5">
            {run.agent_mode}
          </span>
          {run.protection_enabled ? (
            <Lock size={13} className="text-cyan-400" />
          ) : (
            <Unlock size={13} className="text-red-400" />
          )}
          <ChecksSummary evaluation={eval_} />
        </div>
        <button
          onClick={onToggle}
          className="text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1 text-xs"
          aria-label={expanded ? 'Collapse reasoning' : 'Show more'}
        >
          {expanded ? (
            <>
              <ChevronUp size={14} /> Less
            </>
          ) : (
            <>
              <ChevronDown size={14} /> More
            </>
          )}
        </button>
      </div>

      {/* Reasoning truncated to 3 lines with toggle */}
      {eval_.reasoning && (
        <p
          className={`mt-3 text-sm text-gray-400 leading-relaxed ${
            expanded ? '' : 'line-clamp-3'
          }`}
        >
          {eval_.reasoning}
        </p>
      )}

      {/* Expanded checks */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
          {eval_.checks.map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-xs">
              {c.result === 'passed' ? (
                <CheckCircle2 size={12} className="text-cyan-400 flex-shrink-0" />
              ) : c.result === 'failed' ? (
                <XCircle size={12} className="text-red-400 flex-shrink-0" />
              ) : (
                <span className="w-3 h-3 flex-shrink-0 rounded-full bg-gray-700" />
              )}
              <span className="text-gray-400">{c.label}</span>
              <StatusBadge status={c.result} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ResultsPanel({ runs }: ResultsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Only show completed runs with evaluations
  const completedRuns = runs.filter(
    (r) => r.status === 'completed' && r.evaluation !== null
  );

  // Failed/inconclusive runs
  const incompleteRuns = runs.filter(
    (r) => r.status === 'failed' || (r.status === 'completed' && r.evaluation === null)
  );

  // Build comparison map: scenario_id → { protected, unprotected }
  const comparisonMap: Record<
    string,
    { protected?: RecentRunEntry; unprotected?: RecentRunEntry }
  > = {};
  for (const run of completedRuns) {
    if (!comparisonMap[run.scenario_id]) {
      comparisonMap[run.scenario_id] = {};
    }
    if (run.protection_enabled) {
      comparisonMap[run.scenario_id].protected = run;
    } else {
      comparisonMap[run.scenario_id].unprotected = run;
    }
  }
  // Only keep scenarios that have BOTH sides
  const comparisons = Object.entries(comparisonMap).filter(
    ([, pair]) => pair.protected !== undefined && pair.unprotected !== undefined
  );

  if (completedRuns.length === 0 && incompleteRuns.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-8 text-center text-gray-500 text-sm">
        No completed runs yet. Start a run to see results.
      </div>
    );
  }

  function BoolRow({ label, value }: { label: string; value: boolean }) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        {value ? (
          <CheckCircle2 size={12} className="text-cyan-400 flex-shrink-0" />
        ) : (
          <XCircle size={12} className="text-red-400 flex-shrink-0" />
        )}
        {label}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Completed run result cards */}
      {completedRuns.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Completed Runs
          </div>
          {completedRuns.map((run) => (
            <RunResultCard
              key={run.run_id}
              run={run}
              expanded={expandedId === run.run_id}
              onToggle={() =>
                setExpandedId(expandedId === run.run_id ? null : run.run_id)
              }
            />
          ))}
        </div>
      )}

      {/* Comparison section — only when BOTH sides exist for a scenario */}
      {comparisons.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Protected vs Unprotected Comparison
          </div>
          {comparisons.map(([scenarioId, pair]) => {
            const prot = pair.protected!;
            const unprot = pair.unprotected!;
            return (
              <div
                key={scenarioId}
                className="mica-strong rounded-xl overflow-hidden mb-4"
              >
                <div className="px-4 py-2.5 border-b border-white/5">
                  <span className="text-xs font-mono text-gray-300">{scenarioId}</span>
                </div>
                <div className="grid grid-cols-2">
                  {/* Protected column */}
                  <div className="p-4 border-t-2 border-cyan-500">
                    <div className="text-xs font-semibold text-cyan-400 mb-3">Protected</div>
                    <StatusBadge status={prot.evaluation!.verdict} size="md" />
                    <div className="mt-3 space-y-1.5">
                      <BoolRow
                        label="Policy denied"
                        value={prot.evaluation!.policy_denied}
                      />
                      <BoolRow
                        label="Forbidden op occurred"
                        value={prot.evaluation!.forbidden_operation_occurred}
                      />
                    </div>
                  </div>
                  {/* Unprotected column */}
                  <div className="p-4 border-t-2 border-red-500 border-l border-l-white/5">
                    <div className="text-xs font-semibold text-red-400 mb-3">Unprotected</div>
                    <StatusBadge status={unprot.evaluation!.verdict} size="md" />
                    <div className="mt-3 space-y-1.5">
                      <BoolRow
                        label="Policy denied"
                        value={unprot.evaluation!.policy_denied}
                      />
                      <BoolRow
                        label="Forbidden op occurred"
                        value={unprot.evaluation!.forbidden_operation_occurred}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Failed / inconclusive runs */}
      {incompleteRuns.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">
            Inconclusive / Failed Runs
          </div>
          <div className="mica-strong rounded-xl overflow-hidden">
            {incompleteRuns.map((run) => (
              <div
                key={run.run_id}
                className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 text-xs"
              >
                <StatusBadge status={run.status} />
                <span className="font-mono text-gray-400 truncate w-24" title={run.run_id}>
                  {run.run_id.slice(0, 8)}…
                </span>
                <span className="text-gray-400">{run.scenario_id}</span>
                <span className="text-gray-500 ml-auto font-mono">
                  {new Date(run.created_at).toLocaleTimeString('en-US', {
                    hour12: false,
                    timeStyle: 'medium',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
