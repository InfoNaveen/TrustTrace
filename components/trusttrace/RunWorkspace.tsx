'use client';

import { useEffect, useRef, useState } from 'react';
import { Lock, Unlock, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import type { RunResponse } from '@/lib/trusttrace/client';
import { getRun, TrustTraceApiError } from '@/lib/trusttrace/client';
import type { Evaluation, AgentMode, RunStatus } from '@/lib/trusttrace/models';
import { StatusBadge } from '@/components/trusttrace/StatusBadge';
import { EventTimeline } from '@/components/trusttrace/EventTimeline';
import { EvidencePanel } from '@/components/trusttrace/EvidencePanel';

// ============================================================
// RunWorkspace
// ============================================================

interface RecentRunEntry {
  run_id: string;
  scenario_id: string;
  status: RunStatus;
  evaluation: Evaluation | null;
  created_at: string;
  agent_mode: AgentMode;
  protection_enabled: boolean;
}

interface RunWorkspaceProps {
  runId: string;
  onReset: () => void;
  onCompleted: (run: RecentRunEntry) => void;
}

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_S = 150;

export function RunWorkspace({ runId, onReset, onCompleted }: RunWorkspaceProps) {
  const [run, setRun] = useState<RunResponse | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Stable refs to avoid stale closures
  const onCompletedRef = useRef(onCompleted);
  useEffect(() => {
    onCompletedRef.current = onCompleted;
  });

  // Trigger a manual refresh
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let elapsed = 0;

    async function fetchRun() {
      try {
        const data = await getRun(runId);
        if (cancelled) return;
        setRun(data);
        setError(null);

        if (data.status !== 'running') {
          if (intervalId) clearInterval(intervalId);
          onCompletedRef.current({
            run_id: data.run_id,
            scenario_id: data.scenario_id,
            status: data.status,
            evaluation: data.evaluation,
            created_at: data.created_at,
            agent_mode: data.agent_mode,
            protection_enabled: data.protection_enabled,
          });
        }
      } catch (err: unknown) {
        if (cancelled) return;
        if (intervalId) clearInterval(intervalId);
        const msg =
          err instanceof TrustTraceApiError ? err.message : 'Failed to fetch run';
        setError(msg);
      }
    }

    // Initial fetch
    fetchRun().then(() => {
      if (cancelled) return;
      // Only start polling if still running after first fetch
      setRun((current) => {
        if (current && current.status === 'running') {
          intervalId = setInterval(() => {
            elapsed += 2;
            setElapsedSeconds(elapsed);
            if (elapsed >= POLL_TIMEOUT_S) {
              if (intervalId) clearInterval(intervalId);
              if (!cancelled) setTimedOut(true);
              return;
            }
            fetchRun();
          }, POLL_INTERVAL_MS);
        }
        return current;
      });
    });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
    // refreshTick is intentionally included so manual refresh re-runs this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, refreshTick]);

  function handleManualRefresh() {
    setTimedOut(false);
    setElapsedSeconds(0);
    setError(null);
    setRefreshTick((t) => t + 1);
  }

  const selectedEvent =
    run?.events.find((e) => e.event_id === selectedEventId) ?? null;

  // Evaluation summary booleans
  const evalSummaryRows: Array<{ label: string; value: boolean | undefined }> = run?.evaluation
    ? [
        { label: 'Forbidden action attempted', value: run.evaluation.forbidden_action_attempted },
        { label: 'Policy denied', value: run.evaluation.policy_denied },
        { label: 'Forbidden operation occurred', value: run.evaluation.forbidden_operation_occurred },
        { label: 'Legitimate task completed', value: run.evaluation.legitimate_task_completed },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="glass-panel rounded-xl px-5 py-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-mono text-xs text-gray-400 truncate w-32" title={run?.run_id ?? runId}>
            {(run?.run_id ?? runId).slice(0, 8)}…
          </span>
          {run && <StatusBadge status={run.status} size="md" />}
          {run && (
            <span className="text-xs text-gray-400 font-mono">
              {run.scenario_id}
            </span>
          )}
          {run && (
            <span className="text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-full px-2 py-0.5">
              {run.agent_mode}
            </span>
          )}
          {run && (
            <span title={run.protection_enabled ? 'Protected' : 'Unprotected'}>
              {run.protection_enabled ? (
                <Lock size={14} className="text-cyan-400" />
              ) : (
                <Unlock size={14} className="text-red-400" />
              )}
            </span>
          )}
        </div>
        <button
          onClick={onReset}
          className="ml-auto text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5 transition-colors"
        >
          New Run
        </button>
      </div>

      {/* Running indicator */}
      {run?.status === 'running' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-sm">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
          <span>Running… ({elapsedSeconds}s elapsed)</span>
          {run.agent_mode === 'ollama' && (
            <span className="text-amber-400 text-xs ml-1">
              — Ollama inference in progress (~30 s)
            </span>
          )}
        </div>
      )}

      {/* Timeout banner */}
      {timedOut && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm">
          <p className="text-red-300 flex-1">
            Poll timeout (150 s) — the run may still be processing. Click below to refresh manually.
          </p>
          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-1.5 text-xs text-red-300 hover:text-white border border-red-500/30 hover:border-red-400/50 rounded-lg px-2.5 py-1.5 transition-colors"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm">
          <p className="text-red-300 flex-1">{error}</p>
          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-1.5 text-xs text-red-300 hover:text-white border border-red-500/30 hover:border-red-400/50 rounded-lg px-2.5 py-1.5 transition-colors"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      )}

      {/* Evaluation summary */}
      {run && (run.status === 'completed' || run.status === 'failed') && run.evaluation && (
        <div className="mica-strong rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-300">Verdict</span>
            <StatusBadge status={run.evaluation.verdict} size="md" />
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
            {evalSummaryRows.map(({ label, value }) => (
              <div key={label} className="flex items-center gap-2 text-sm">
                {value ? (
                  <CheckCircle2 size={14} className="text-cyan-400 flex-shrink-0" />
                ) : (
                  <XCircle size={14} className="text-red-400 flex-shrink-0" />
                )}
                <span className="text-gray-300">{label}</span>
              </div>
            ))}
          </div>
          {run.evaluation.reasoning && (
            <p className="text-sm text-gray-300 border-t border-white/5 pt-3">
              {run.evaluation.reasoning}
            </p>
          )}
        </div>
      )}

      {/* Timeline + Evidence two-column */}
      {run && (
        <div className="grid md:grid-cols-2 gap-4">
          <EventTimeline
            events={run.events}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
          />
          <EvidencePanel
            event={selectedEvent}
            allEvents={run.events}
          />
        </div>
      )}

      {/* Loading skeleton if no run yet */}
      {!run && !error && (
        <div className="h-32 glass-panel rounded-xl animate-pulse" />
      )}
    </div>
  );
}
