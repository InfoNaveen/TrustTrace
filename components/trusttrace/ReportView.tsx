'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { getReport, TrustTraceApiError } from '@/lib/trusttrace/client';
import type { Report, PolicyDecision, ToolResult } from '@/lib/trusttrace/models';
import { StatusBadge } from '@/components/trusttrace/StatusBadge';

// ============================================================
// ReportView
// ============================================================

interface ReportViewProps {
  runId: string;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mica-strong rounded-xl p-6 mb-4">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5 text-sm border-b border-white/5 last:border-0">
      <span className="text-gray-500 min-w-[160px] flex-shrink-0">{label}</span>
      <span className="text-gray-200 break-all">{children}</span>
    </div>
  );
}

function truncate(s: string | undefined | null, max: number): string {
  if (!s) return '—';
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function formatTs(ts: string | null | undefined): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export function ReportView({ runId }: ReportViewProps) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getReport(runId)
      .then((data) => {
        if (!cancelled) {
          setReport(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof TrustTraceApiError && err.status === 409) {
          setError('Report not yet available — the run must complete first.');
        } else if (err instanceof TrustTraceApiError) {
          setError(err.message);
        } else {
          setError('Failed to load report');
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="mica-strong rounded-xl p-6 h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel rounded-xl p-6 text-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div>
      {/* 1. Run Metadata */}
      <SectionCard title="Run Metadata">
        <MetaRow label="run_id">
          <span className="font-mono text-xs">{report.run_id}</span>
        </MetaRow>
        <MetaRow label="scenario">
          <span className="font-mono text-xs">{report.scenario.id}</span>
          <span className="ml-2 text-gray-400">{report.scenario.name}</span>
        </MetaRow>
        <MetaRow label="execution_mode">{report.execution_mode}</MetaRow>
        <MetaRow label="agent type">{report.agent_identity.type}</MetaRow>
        {report.agent_identity.model && (
          <MetaRow label="model">
            <span className="font-mono text-xs">{report.agent_identity.model}</span>
          </MetaRow>
        )}
        {report.agent_identity.base_url && (
          <MetaRow label="base_url">
            <span className="font-mono text-xs">{report.agent_identity.base_url}</span>
          </MetaRow>
        )}
        <MetaRow label="protection">
          <StatusBadge
            status={report.protection_config.protection_enabled ? 'enabled' : 'disabled'}
          />
        </MetaRow>
        {report.protection_config.rules_applied.length > 0 && (
          <MetaRow label="rules_applied">
            <div className="flex flex-wrap gap-1">
              {report.protection_config.rules_applied.map((r) => (
                <span
                  key={r}
                  className="font-mono text-xs bg-white/5 px-1.5 py-0.5 rounded text-gray-400"
                >
                  {r}
                </span>
              ))}
            </div>
          </MetaRow>
        )}
        <MetaRow label="started_at">{formatTs(report.started_at)}</MetaRow>
        <MetaRow label="completed_at">{formatTs(report.completed_at)}</MetaRow>
      </SectionCard>

      {/* 2. Evaluation */}
      <SectionCard title="Evaluation">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-gray-400">Verdict</span>
          <StatusBadge status={report.evaluation.verdict} size="md" />
        </div>

        {/* Checks table */}
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="dashboard-table-header rounded-tl-lg">Label</th>
                <th className="dashboard-table-header">Result</th>
                <th className="dashboard-table-header rounded-tr-lg">Detail</th>
              </tr>
            </thead>
            <tbody>
              {report.evaluation.checks.map((check) => (
                <tr key={check.id} className="dashboard-table-row">
                  <td className="dashboard-table-cell text-gray-300">{check.label}</td>
                  <td className="dashboard-table-cell">
                    <StatusBadge status={check.result} />
                  </td>
                  <td className="dashboard-table-cell text-gray-400">{check.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-gray-300">{report.evaluation.reasoning}</p>

        {report.evaluation.baseline_vs_protected_note && (
          <p className="mt-3 text-xs text-gray-400 border-t border-white/5 pt-3">
            {report.evaluation.baseline_vs_protected_note}
          </p>
        )}

        {report.failed_checks.length > 0 && (
          <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <div className="text-xs font-semibold text-red-400 mb-1">Failed checks</div>
            <ul className="list-disc list-inside text-xs text-red-300 space-y-0.5">
              {report.failed_checks.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {report.missing_checks.length > 0 && (
          <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <div className="text-xs font-semibold text-amber-400 mb-1">Missing checks</div>
            <ul className="list-disc list-inside text-xs text-amber-300 space-y-0.5">
              {report.missing_checks.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>

      {/* 3. Event Trace */}
      <SectionCard title="Event Trace">
        <div className="divide-y divide-white/5">
          {report.event_trace.map((event) => (
            <div
              key={event.event_id}
              className="flex items-center gap-3 py-2 text-xs"
            >
              <span className="text-gray-500 font-mono w-6 flex-shrink-0">
                #{event.seq}
              </span>
              <span className="text-gray-300 w-36 flex-shrink-0">{event.type}</span>
              {event.tool && (
                <span className="text-cyan-400 font-mono">{event.tool}</span>
              )}
              {event.outcome && <StatusBadge status={event.outcome} />}
              <span className="text-gray-600 ml-auto">{formatTs(event.timestamp)}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 4. Policy Decisions */}
      {report.policy_decisions.length > 0 && (
        <SectionCard title="Policy Decisions">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="dashboard-table-header">Action ID</th>
                  <th className="dashboard-table-header">Tool</th>
                  <th className="dashboard-table-header">Rule</th>
                  <th className="dashboard-table-header">Decision</th>
                  <th className="dashboard-table-header">Reason</th>
                </tr>
              </thead>
              <tbody>
                {report.policy_decisions.map((pd: PolicyDecision) => (
                  <tr key={pd.action_id} className="dashboard-table-row">
                    <td className="dashboard-table-cell">
                      <span className="font-mono text-xs text-gray-400 truncate block w-24">
                        {pd.action_id.slice(0, 8)}…
                      </span>
                    </td>
                    <td className="dashboard-table-cell font-mono text-xs text-gray-300">
                      {pd.tool}
                    </td>
                    <td className="dashboard-table-cell font-mono text-xs text-gray-400">
                      {pd.rule_id}
                    </td>
                    <td className="dashboard-table-cell">
                      <StatusBadge status={pd.decision} />
                    </td>
                    <td className="dashboard-table-cell text-gray-400 max-w-xs">
                      {pd.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* 5. Tool Outcomes */}
      {report.tool_outcomes.length > 0 && (
        <SectionCard title="Tool Outcomes">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="dashboard-table-header">Action ID</th>
                  <th className="dashboard-table-header">Tool</th>
                  <th className="dashboard-table-header">Executed</th>
                  <th className="dashboard-table-header">Outcome</th>
                  <th className="dashboard-table-header">Summary</th>
                </tr>
              </thead>
              <tbody>
                {report.tool_outcomes.map((tr: ToolResult) => {
                  const summaryRaw =
                    tr.data.content ??
                    tr.data.summary ??
                    tr.data.redacted_payload ??
                    null;
                  const summary = truncate(summaryRaw, 80);
                  return (
                    <tr key={tr.action_id} className="dashboard-table-row">
                      <td className="dashboard-table-cell">
                        <span className="font-mono text-xs text-gray-400 truncate block w-24">
                          {tr.action_id.slice(0, 8)}…
                        </span>
                      </td>
                      <td className="dashboard-table-cell font-mono text-xs text-gray-300">
                        {tr.tool}
                      </td>
                      <td className="dashboard-table-cell">
                        {tr.executed ? (
                          <CheckCircle2 size={14} className="text-cyan-400" />
                        ) : (
                          <XCircle size={14} className="text-red-400" />
                        )}
                      </td>
                      <td className="dashboard-table-cell">
                        <StatusBadge status={tr.outcome} />
                      </td>
                      <td className="dashboard-table-cell">
                        <span className="font-mono text-xs text-gray-400">{summary}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* 6. Source-to-Action */}
      {report.source_to_action.length > 0 && (
        <SectionCard title="Source to Action">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="dashboard-table-header">source_id</th>
                  <th className="dashboard-table-header">origin</th>
                  <th className="dashboard-table-header">trust</th>
                  <th className="dashboard-table-header">actions</th>
                </tr>
              </thead>
              <tbody>
                {report.source_to_action.map((row) => (
                  <tr key={row.source_id} className="dashboard-table-row">
                    <td className="dashboard-table-cell font-mono text-xs text-gray-300">
                      {row.source_id}
                    </td>
                    <td className="dashboard-table-cell text-gray-400">{row.origin}</td>
                    <td className="dashboard-table-cell">
                      <span
                        className={
                          row.trust === 'trusted'
                            ? 'text-cyan-400'
                            : 'text-amber-400'
                        }
                      >
                        {row.trust}
                      </span>
                    </td>
                    <td className="dashboard-table-cell text-gray-400">
                      {row.action_ids.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* 7. Known Limitations */}
      {report.known_limitations.length > 0 && (
        <SectionCard title="Known Limitations">
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-400">
            {report.known_limitations.map((lim, i) => (
              <li key={i}>{lim}</li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
