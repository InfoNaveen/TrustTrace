'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FlaskConical, ShieldCheck, ShieldAlert, Shield, Activity,
  Play, RefreshCw, ChevronRight, ChevronDown, AlertTriangle,
  CheckCircle, XCircle, Clock, Info, FileText, Eye, Zap, Lock
} from 'lucide-react';
import {
  getHealth, getScenarios, createRun, getRun, getReport,
  TrustTraceApiError,
  type HealthResponse, type RunResponse, type CreateRunResponse
} from '@/lib/trusttrace/client';
import type { ScenarioPublic, Event, Evaluation, Report, RunRequest } from '@/lib/trusttrace/models';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'configure' | 'workspace' | 'report';
type AgentMode = 'scripted' | 'ollama';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour12: false, timeStyle: 'medium' });
}
function fmtTs(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour12: false, timeStyle: 'medium' });
}

// ─── Status / verdict badge ───────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  running:          'bg-amber-500/15 text-amber-300 border-amber-500/30',
  completed:        'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  failed:           'bg-red-500/15 text-red-400 border-red-500/30',
  blocked:          'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  attack_succeeded: 'bg-red-500/15 text-red-400 border-red-500/30',
  passed:           'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  inconclusive:     'bg-amber-500/15 text-amber-300 border-amber-500/30',
  allow:            'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  deny:             'bg-red-500/15 text-red-400 border-red-500/30',
  success:          'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  denied:           'bg-red-500/15 text-red-400 border-red-500/30',
  error:            'bg-red-500/15 text-red-400 border-red-500/30',
  not_performed:    'bg-gray-500/15 text-gray-400 border-gray-500/30',
  untrusted:        'bg-red-500/15 text-red-400 border-red-500/30',
  trusted:          'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

function Badge({ label, size = 'sm' }: { label: string; size?: 'sm' | 'md' | 'lg' }) {
  const col = STATUS_COLORS[label] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/30';
  const sz = size === 'lg' ? 'text-sm px-3 py-1' : size === 'md' ? 'text-xs px-2.5 py-0.5' : 'text-xs px-2 py-0.5';
  return (
    <span className={cn('inline-flex items-center rounded-full border font-semibold', sz, col)}>
      {label.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Event type color ─────────────────────────────────────────────────────────

const EVENT_COLORS: Record<string, string> = {
  run_started:       'text-cyan-400',
  untrusted_input:   'text-amber-400',
  agent_action:      'text-purple-400',
  tool_attempt:      'text-blue-400',
  policy_decision:   'text-orange-400',
  tool_result:       'text-emerald-400',
  run_completed:     'text-cyan-400',
  run_failed:        'text-red-400',
  evaluation_result: 'text-yellow-400',
};

// ─── Section card ─────────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-brand-surface border border-gray-700/50 rounded-lg', className)}>
      {children}
    </div>
  );
}

// ─── Loading spinner ──────────────────────────────────────────────────────────

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="animate-spin text-brand-secondary" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

// ─── Health card ──────────────────────────────────────────────────────────────

function HealthCard({ health, loading, error }: { health: HealthResponse | null; loading: boolean; error: string | null }) {
  if (loading) return (
    <Card className="p-4 flex items-center gap-3">
      <Spinner /><span className="text-sm text-gray-400">Checking backend…</span>
    </Card>
  );
  if (error) return (
    <Card className="p-4 border-red-500/30">
      <p className="text-sm text-red-400 flex items-center gap-2"><XCircle size={14}/> Backend unreachable: {error}</p>
    </Card>
  );
  if (!health) return null;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <ShieldCheck size={18} className="text-emerald-400"/>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-100">Backend <span className="text-emerald-400">●</span></p>
            <p className="text-xs text-gray-500">{health.module} v{health.version}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg border', health.ollama.reachable
            ? 'bg-emerald-500/10 border-emerald-500/20'
            : 'bg-red-500/10 border-red-500/20')}>
            <Zap size={18} className={health.ollama.reachable ? 'text-emerald-400' : 'text-red-400'}/>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-100">
              Ollama {health.ollama.reachable ? <span className="text-emerald-400">●</span> : <span className="text-red-400">●</span>}
            </p>
            <p className="text-xs text-gray-500">{health.ollama.model} · {health.ollama.base_url}</p>
            {health.ollama.error && <p className="text-xs text-red-400">{health.ollama.error}</p>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {health.capabilities.scripted && <Badge label="scripted"/>}
          {health.capabilities.ollama && <Badge label="ollama"/>}
        </div>
      </div>
    </Card>
  );
}

// ─── Run configuration ────────────────────────────────────────────────────────

function RunConfig({
  scenarios, health, onRunStarted
}: {
  scenarios: ScenarioPublic[];
  health: HealthResponse | null;
  onRunStarted: (runId: string) => void;
}) {
  const [scenarioId, setScenarioId] = useState('');
  const [protection, setProtection] = useState(true);
  const [mode, setMode] = useState<AgentMode>('scripted');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ollamaReady = health?.ollama?.reachable === true;
  const canSubmit = scenarioId !== '' && !loading && (mode === 'scripted' || ollamaReady);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const req: RunRequest = {
        scenario_id: scenarioId,
        protection_enabled: protection,
        agent_mode: mode,
      };
      if (mode === 'ollama' && health?.ollama) {
        req.ollama = { base_url: health.ollama.base_url, model: health.ollama.model };
      }
      const res: CreateRunResponse = await createRun(req);
      onRunStarted(res.run_id);
    } catch (err) {
      setError(err instanceof TrustTraceApiError ? err.message : 'Failed to start run');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Scenario */}
      <div>
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Scenario</label>
        <div className="space-y-2">
          {scenarios.length === 0 && (
            <p className="text-sm text-gray-500 italic">Loading scenarios…</p>
          )}
          {scenarios.map(s => (
            <label key={s.id} className={cn(
              'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
              scenarioId === s.id
                ? 'border-brand-secondary bg-brand-secondary/5'
                : 'border-gray-700/50 hover:border-gray-600 bg-brand-surface'
            )}>
              <input
                type="radio"
                name="scenario"
                value={s.id}
                checked={scenarioId === s.id}
                onChange={() => setScenarioId(s.id)}
                className="mt-0.5 accent-cyan-400"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-100">{s.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {s.tools.map(t => (
                    <span key={t} className="text-xs font-mono bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded text-gray-400">{t}</span>
                  ))}
                </div>
              </div>
              {s.simulated && <span className="text-xs text-amber-400 font-medium shrink-0">simulated</span>}
            </label>
          ))}
        </div>
      </div>

      {/* Protection */}
      <div>
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Policy Protection</label>
        <div className="flex gap-3">
          {([true, false] as const).map(v => (
            <label key={String(v)} className={cn(
              'flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors text-sm font-medium',
              protection === v
                ? v ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-red-500/50 bg-red-500/10 text-red-400'
                : 'border-gray-700/50 text-gray-500 hover:border-gray-600'
            )}>
              <input type="radio" name="protection" value={String(v)} checked={protection === v} onChange={() => setProtection(v)} className="sr-only"/>
              {v ? <><ShieldCheck size={14}/> Enabled</> : <><ShieldAlert size={14}/> Disabled (baseline)</>}
            </label>
          ))}
        </div>
        {!protection && (
          <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1">
            <AlertTriangle size={11}/> Baseline mode: policy OFF — attack will succeed to demonstrate the threat
          </p>
        )}
      </div>

      {/* Agent mode */}
      <div>
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Agent Mode</label>
        <div className="flex gap-3">
          {(['scripted', 'ollama'] as AgentMode[]).map(m => (
            <label key={m} className={cn(
              'flex-1 p-3 rounded-lg border cursor-pointer transition-colors',
              mode === m
                ? 'border-brand-secondary bg-brand-secondary/5'
                : 'border-gray-700/50 hover:border-gray-600 bg-brand-surface',
              m === 'ollama' && !ollamaReady ? 'opacity-50' : ''
            )}>
              <input type="radio" name="mode" value={m} checked={mode === m}
                onChange={() => setMode(m)} disabled={m === 'ollama' && !ollamaReady} className="sr-only"/>
              <p className="text-sm font-semibold text-gray-100 capitalize">{m}</p>
              <p className="text-xs text-gray-500 mt-1">
                {m === 'scripted'
                  ? 'Deterministic action sequence — repeatable policy tests. Not a demonstration of LLM behavior.'
                  : ollamaReady
                    ? `Real inference via qwen2.5:7b. Model's tool requests validated by the policy engine.`
                    : 'Ollama not reachable — start Ollama and pull qwen2.5:7b.'}
              </p>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <XCircle size={14}/> {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all',
          canSubmit
            ? 'bg-brand-secondary text-brand-dark hover:bg-brand-secondary/90'
            : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'
        )}
      >
        {loading ? <><Spinner size={14}/> Starting…</> : <><Play size={14}/> Run Scenario</>}
      </button>
    </form>
  );
}

// ─── Event inspector panel ────────────────────────────────────────────────────

function EventInspector({ event, allEvents, onClose }: {
  event: Event;
  allEvents: Event[];
  onClose: () => void;
}) {
  const related = allEvents.filter(e =>
    e.action_id && event.action_id && e.action_id === event.action_id && e.event_id !== event.event_id
  );

  function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="flex gap-2 text-xs">
        <span className="text-gray-500 w-28 shrink-0">{label}</span>
        <span className="text-gray-300 font-mono break-all">{children}</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative w-full max-w-lg h-full bg-brand-surface border-l border-gray-700/50 overflow-y-auto shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-gray-700/50 bg-brand-surface z-10">
          <div className="flex items-center gap-2">
            <Eye size={14} className="text-brand-secondary"/>
            <span className="text-sm font-semibold text-gray-100">Evidence Inspector</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">&times;</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Core fields */}
          <Card className="p-3 space-y-1.5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Event</p>
            <MetaRow label="type"><span className={cn('font-semibold', EVENT_COLORS[event.type] ?? 'text-gray-300')}>{event.type}</span></MetaRow>
            <MetaRow label="seq">#{event.seq}</MetaRow>
            <MetaRow label="timestamp">{fmtTs(event.timestamp)}</MetaRow>
            <MetaRow label="event_id">{event.event_id}</MetaRow>
            {event.source_id && <MetaRow label="source_id">{event.source_id}</MetaRow>}
            {event.action_id && <MetaRow label="action_id">{event.action_id}</MetaRow>}
            {event.tool && <MetaRow label="tool">{event.tool}</MetaRow>}
            {event.outcome && <MetaRow label="outcome"><Badge label={event.outcome}/></MetaRow>}
          </Card>

          {/* Metadata */}
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <Card className="p-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Metadata</p>
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all leading-relaxed">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </Card>
          )}

          {/* Policy decision highlight */}
          {event.type === 'policy_decision' && (event.metadata as Record<string, unknown>) && (
            <Card className={cn('p-3 border', (event.metadata as Record<string, unknown>).decision === 'deny' ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/30 bg-emerald-500/5')}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Policy Decision</p>
              <div className="flex items-center gap-2 mb-2">
                <Badge label={String((event.metadata as Record<string, unknown>).decision ?? '')} size="md"/>
                <span className="text-xs text-gray-400">rule: <span className="font-mono text-gray-300">{String((event.metadata as Record<string, unknown>).rule_id ?? '')}</span></span>
              </div>
              <p className="text-xs text-gray-400">{String((event.metadata as Record<string, unknown>).reason ?? '')}</p>
            </Card>
          )}

          {/* Related events */}
          {related.length > 0 && (
            <Card className="p-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Related Events (same action)</p>
              <div className="space-y-1">
                {related.map(r => (
                  <div key={r.event_id} className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="font-mono">#{r.seq}</span>
                    <span className={EVENT_COLORS[r.type] ?? 'text-gray-400'}>{r.type}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Event row ────────────────────────────────────────────────────────────────

function EventRow({ event, onClick, active }: {
  event: Event;
  onClick: () => void;
  active: boolean;
}) {
  const meta = event.metadata as Record<string, unknown>;
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 px-3 py-2.5 border-b border-gray-800/60 cursor-pointer transition-colors hover:bg-gray-800/40 text-xs',
        active && 'bg-brand-secondary/10 border-l-2 border-l-brand-secondary'
      )}
    >
      <span className="text-gray-600 font-mono w-5 text-right shrink-0">{event.seq}</span>
      <span className="text-gray-600 font-mono shrink-0 w-16">{fmtTs(event.timestamp)}</span>
      <span className={cn('font-semibold w-32 shrink-0', EVENT_COLORS[event.type] ?? 'text-gray-400')}>{event.type.replace(/_/g, '_')}</span>
      <span className="text-gray-400 truncate">
        {event.type === 'agent_action' && typeof meta.args_summary === 'string' && <span>{meta.args_summary}</span>}
        {event.type === 'policy_decision' && <><Badge label={String(meta.decision)}/> <span className="ml-1">{String(meta.rule_id ?? '')}</span></>}
        {event.type === 'tool_result' && <><Badge label={String((meta.executed ? (meta as Record<string,unknown>).outcome ?? 'success' : 'denied'))}/></>}
        {event.type === 'untrusted_input' && <span className="font-mono">{String(meta.origin ?? meta.source_type ?? '')}</span>}
        {event.type === 'evaluation_result' && <Badge label={String((meta as Record<string,Record<string,unknown>>).evaluation?.verdict ?? meta.verdict ?? '')}/>}
        {event.type === 'run_failed' && <span className="text-red-400">{String(meta.reason ?? '')}</span>}
      </span>
      <ChevronRight size={12} className="shrink-0 text-gray-700 mt-0.5"/>
    </div>
  );
}

// ─── Evaluation view ──────────────────────────────────────────────────────────

function EvaluationPanel({ evaluation }: { evaluation: Evaluation }) {
  const verdictSize: Record<string, string> = {
    blocked: 'text-2xl text-cyan-300',
    passed: 'text-2xl text-emerald-400',
    attack_succeeded: 'text-2xl text-red-400',
    failed: 'text-2xl text-red-400',
    inconclusive: 'text-2xl text-amber-300',
  };
  const checkIcon = (r: string) => r === 'passed'
    ? <CheckCircle size={14} className="text-emerald-400 shrink-0"/>
    : r === 'failed'
      ? <XCircle size={14} className="text-red-400 shrink-0"/>
      : <Info size={14} className="text-gray-500 shrink-0"/>;

  return (
    <div className="space-y-4">
      {/* Verdict */}
      <Card className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Verdict</p>
          <p className={cn('font-bold uppercase tracking-wide', verdictSize[evaluation.verdict] ?? 'text-gray-300 text-xl')}>
            {evaluation.verdict.replace(/_/g, ' ')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          {[
            ['Forbidden attempted', evaluation.forbidden_action_attempted],
            ['Protected op occurred', evaluation.forbidden_operation_occurred],
            ['Policy denied', evaluation.policy_denied],
            ['Legitimate task done', evaluation.legitimate_task_completed],
          ].map(([label, val]) => (
            <div key={String(label)} className="flex items-center gap-1.5">
              {val ? <CheckCircle size={11} className="text-emerald-400"/> : <XCircle size={11} className="text-red-400"/>}
              <span className="text-gray-400">{String(label)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Checks */}
      <Card className="divide-y divide-gray-800/60">
        {evaluation.checks.map(c => (
          <div key={c.id} className="flex items-start gap-3 px-4 py-2.5 text-xs">
            {checkIcon(c.result)}
            <span className="text-gray-400 w-6 font-mono">{c.id}</span>
            <span className="text-gray-300 flex-1">{c.label}</span>
            <Badge label={c.result}/>
          </div>
        ))}
      </Card>

      {evaluation.baseline_vs_protected_note && (
        <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <AlertTriangle size={12} className="shrink-0 mt-0.5"/>
          <span>{evaluation.baseline_vs_protected_note}</span>
        </div>
      )}

      {evaluation.reasoning && (
        <Card className="p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Reasoning</p>
          <p className="text-xs text-gray-400 leading-relaxed">{evaluation.reasoning}</p>
          <p className="text-xs text-gray-600 mt-1.5 italic">Note: Reasoning is non-authoritative. Verdict derives from actual tool outcomes.</p>
        </Card>
      )}
    </div>
  );
}

// ─── Report view ──────────────────────────────────────────────────────────────

function ReportPanel({ runId }: { runId: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReport(runId)
      .then(r => { setReport(r); setLoading(false); })
      .catch(err => {
        setError(err instanceof TrustTraceApiError ? err.message : 'Failed to load report');
        setLoading(false);
      });
  }, [runId]);

  if (loading) return <div className="flex items-center gap-3 p-6 text-gray-400 text-sm"><Spinner/> Loading report…</div>;
  if (error) return (
    <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
      <XCircle size={14}/> {error}
    </div>
  );
  if (!report) return null;

  return (
    <div className="space-y-4 text-xs">
      {/* Header */}
      <Card className="p-4 grid grid-cols-2 gap-3">
        <div><span className="text-gray-500">Run ID</span><p className="font-mono text-gray-300 truncate">{report.run_id}</p></div>
        <div><span className="text-gray-500">Scenario</span><p className="text-gray-300">{report.scenario.name}</p></div>
        <div><span className="text-gray-500">Mode</span><p className="text-gray-300">{report.execution_mode}</p></div>
        <div><span className="text-gray-500">Protection</span><p className="text-gray-300">{report.protection_config.protection_enabled ? 'Enabled' : 'Disabled (baseline)'}</p></div>
        <div><span className="text-gray-500">Started</span><p className="text-gray-300">{fmtTs(report.started_at)}</p></div>
        <div><span className="text-gray-500">Completed</span><p className="text-gray-300">{report.completed_at ? fmtTs(report.completed_at) : '—'}</p></div>
      </Card>

      {/* Verdict */}
      <EvaluationPanel evaluation={report.evaluation}/>

      {/* Policy decisions */}
      {report.policy_decisions.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-800/60"><p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Policy Decisions</p></div>
          <div className="divide-y divide-gray-800/60">
            {report.policy_decisions.map((d, i) => (
              <div key={i} className="px-4 py-2 flex items-start gap-3">
                <Badge label={d.decision}/>
                <span className="font-mono text-gray-300">{d.tool}</span>
                <span className="text-gray-500 flex-1">{d.rule_id}</span>
                <span className="text-gray-600 font-mono">{fmtTs(d.timestamp)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tool outcomes */}
      {report.tool_outcomes.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-800/60"><p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tool Outcomes</p></div>
          <div className="divide-y divide-gray-800/60">
            {report.tool_outcomes.map((t, i) => (
              <div key={i} className="px-4 py-2 flex items-center gap-3">
                <Badge label={t.outcome}/>
                <span className={cn('font-mono', t.executed ? 'text-emerald-400' : 'text-red-400')}>{t.executed ? 'executed' : 'blocked'}</span>
                <span className="text-gray-400">{t.tool}</span>
                {t.error && <span className="text-red-400 text-xs">{t.error}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Source to action */}
      {report.source_to_action.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-800/60"><p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Source → Action</p></div>
          <div className="divide-y divide-gray-800/60">
            {report.source_to_action.map((s, i) => (
              <div key={i} className="px-4 py-2 flex items-center gap-3">
                <Badge label={s.trust}/>
                <span className="font-mono text-gray-300">{s.source_id}</span>
                <span className="text-gray-500">{s.origin}</span>
                <span className="text-gray-600 ml-auto">{s.action_ids.length} action(s)</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Limitations */}
      {report.known_limitations.length > 0 && (
        <Card className="p-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Known Limitations</p>
          <ul className="space-y-1">
            {report.known_limitations.map((l, i) => (
              <li key={i} className="flex items-start gap-1.5 text-gray-500"><span className="text-gray-600 mt-0.5">•</span>{l}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// ─── Run workspace ────────────────────────────────────────────────────────────

function RunWorkspace({
  runId,
  onReport
}: {
  runId: string;
  onReport: () => void;
}) {
  const [run, setRun] = useState<RunResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  const poll = useCallback(async () => {
    try {
      const data = await getRun(runId);
      if (!isMounted.current) return;
      setRun(data);
      setLoading(false);
      if (data.status === 'running') {
        pollRef.current = setTimeout(poll, 2000);
      }
    } catch (err) {
      if (!isMounted.current) return;
      setError(err instanceof TrustTraceApiError ? err.message : 'Failed to fetch run');
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    isMounted.current = true;
    poll();
    return () => {
      isMounted.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [poll]);

  if (loading && !run) return (
    <div className="flex items-center gap-3 p-6 text-gray-400 text-sm"><Spinner/> Loading run…</div>
  );
  if (error) return (
    <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
      <XCircle size={14}/> {error}
    </div>
  );
  if (!run) return null;

  const evaluation = run.evaluation;

  return (
    <div className="space-y-4">
      {/* Run header */}
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge label={run.status} size="md"/>
              {run.status === 'running' && <Spinner size={12}/>}
            </div>
            <p className="text-xs text-gray-500 font-mono">{run.run_id}</p>
          </div>
          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><FlaskConical size={11}/> {run.scenario_id}</span>
            <span className="flex items-center gap-1"><Activity size={11}/> {run.agent_mode}</span>
            <span className="flex items-center gap-1">
              {run.protection_enabled
                ? <><Lock size={11} className="text-emerald-400"/> protected</>
                : <><ShieldAlert size={11} className="text-amber-400"/> baseline</>}
            </span>
          </div>
        </div>
      </Card>

      {/* Verdict when done */}
      {evaluation && run.status !== 'running' && (
        <div className="space-y-3">
          <EvaluationPanel evaluation={evaluation}/>
          <button
            onClick={onReport}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-secondary/10 border border-brand-secondary/30 text-brand-secondary text-sm font-medium hover:bg-brand-secondary/20 transition-colors"
          >
            <FileText size={14}/> View Full Evidence Report
          </button>
        </div>
      )}

      {/* Event timeline */}
      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-800/60 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Event Timeline <span className="text-gray-600 font-normal ml-1">({run.events.length} events)</span>
          </p>
          {run.status === 'running' && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <Spinner size={10}/> polling
            </div>
          )}
        </div>
        {run.events.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 text-center">No events yet…</div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {run.events.map(e => (
              <EventRow
                key={e.event_id}
                event={e}
                onClick={() => setSelectedEvent(e)}
                active={selectedEvent?.event_id === e.event_id}
              />
            ))}
          </div>
        )}
        <p className="px-4 py-2 text-xs text-gray-600 border-t border-gray-800/60">Click any event to inspect evidence</p>
      </Card>

      {selectedEvent && (
        <EventInspector
          event={selectedEvent}
          allEvents={run.events}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function Overview({
  health, healthLoading, healthError,
  scenarios, scenariosLoading,
  recentRunIds, onNewRun, onSelectRun
}: {
  health: HealthResponse | null;
  healthLoading: boolean;
  healthError: string | null;
  scenarios: ScenarioPublic[];
  scenariosLoading: boolean;
  recentRunIds: string[];
  onNewRun: () => void;
  onSelectRun: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-brand-secondary/10 border border-brand-secondary/20">
          <FlaskConical size={28} className="text-brand-secondary"/>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-100">DevSentinel TrustTrace</h1>
          <p className="text-sm text-gray-400 mt-1">Observe the attempt. Enforce the boundary. Prove the outcome.</p>
          <p className="text-xs text-gray-600 mt-2 max-w-xl">
            TrustTrace evaluates whether untrusted repository content can influence a tool-using AI coding agent to request
            unauthorized actions, and whether a deterministic policy layer actually prevents those actions.
            Verdicts derive from actual tool outcomes — not model reasoning.
          </p>
        </div>
      </div>

      {/* Health */}
      <HealthCard health={health} loading={healthLoading} error={healthError}/>

      {/* Scenarios */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Available Scenarios</h2>
        {scenariosLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner size={12}/> Loading…</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {scenarios.map(s => (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold text-gray-100">{s.name}</p>
                  {s.simulated && <Badge label="simulated"/>}
                </div>
                <p className="text-xs text-gray-500 mb-2">{s.description}</p>
                <p className="text-xs text-gray-600 italic">{s.expected_invariant}</p>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recent runs */}
      {recentRunIds.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Runs</h2>
          <div className="space-y-1">
            {recentRunIds.slice().reverse().map(id => (
              <button
                key={id}
                onClick={() => onSelectRun(id)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-700/50 hover:border-gray-600 bg-brand-surface text-left transition-colors"
              >
                <Clock size={12} className="text-gray-600 shrink-0"/>
                <span className="font-mono text-xs text-gray-400 truncate">{id}</span>
                <ChevronRight size={12} className="text-gray-600 ml-auto shrink-0"/>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onNewRun}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-secondary text-brand-dark text-sm font-semibold hover:bg-brand-secondary/90 transition-colors"
      >
        <Play size={14}/> Run a Scenario
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TrustTracePage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioPublic[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(true);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [recentRunIds, setRecentRunIds] = useState<string[]>([]);

  // Load health + scenarios on mount
  useEffect(() => {
    getHealth()
      .then(h => { setHealth(h); setHealthLoading(false); })
      .catch(err => { setHealthError(err instanceof TrustTraceApiError ? err.message : 'unreachable'); setHealthLoading(false); });
    getScenarios()
      .then(s => { setScenarios(s); setScenariosLoading(false); })
      .catch(() => setScenariosLoading(false));
  }, []);

  function handleRunStarted(runId: string) {
    setActiveRunId(runId);
    setRecentRunIds(prev => [...prev, runId].slice(-10));
    setTab('workspace');
  }

  function handleSelectRun(runId: string) {
    setActiveRunId(runId);
    setTab('workspace');
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Shield size={14}/> },
    { id: 'configure', label: 'Run', icon: <Play size={14}/> },
    { id: 'workspace', label: 'Workspace', icon: <Activity size={14}/> },
    { id: 'report', label: 'Report', icon: <FileText size={14}/> },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-brand-surface border border-gray-700/50 rounded-lg p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            disabled={t.id === 'workspace' && !activeRunId}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center',
              tab === t.id
                ? 'bg-gray-700/60 text-gray-100'
                : 'text-gray-500 hover:text-gray-300',
              t.id === 'workspace' && !activeRunId ? 'opacity-40 cursor-not-allowed' : ''
            )}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'overview' && (
        <Overview
          health={health}
          healthLoading={healthLoading}
          healthError={healthError}
          scenarios={scenarios}
          scenariosLoading={scenariosLoading}
          recentRunIds={recentRunIds}
          onNewRun={() => setTab('configure')}
          onSelectRun={handleSelectRun}
        />
      )}

      {tab === 'configure' && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <Play size={14} className="text-brand-secondary"/> Configure Run
          </h2>
          <RunConfig
            scenarios={scenarios}
            health={health}
            onRunStarted={handleRunStarted}
          />
        </Card>
      )}

      {tab === 'workspace' && activeRunId && (
        <RunWorkspace
          key={activeRunId}
          runId={activeRunId}
          onReport={() => setTab('report')}
        />
      )}

      {tab === 'report' && activeRunId && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <FileText size={14} className="text-brand-secondary"/> Evidence Report
          </h2>
          <ReportPanel runId={activeRunId}/>
        </Card>
      )}
    </div>
  );
}
