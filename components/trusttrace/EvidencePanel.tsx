'use client';

import type { Event } from '@/lib/trusttrace/models';
import { StatusBadge } from '@/components/trusttrace/StatusBadge';

// ============================================================
// EvidencePanel
// ============================================================

interface EvidencePanelProps {
  event: Event | null;
  allEvents: Event[];
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1 text-sm">
      <span className="text-gray-500 min-w-[130px] flex-shrink-0">{label}</span>
      <span className="text-gray-200 break-all">{children}</span>
    </div>
  );
}

export function EvidencePanel({ event, allEvents }: EvidencePanelProps) {
  if (!event) {
    return (
      <div className="glass-panel rounded-xl p-6 text-center text-gray-500 text-sm">
        Select an event to inspect evidence
      </div>
    );
  }

  // Related events — share same action_id
  const relatedEvents =
    event.action_id
      ? allEvents.filter(
          (e) => e.event_id !== event.event_id && e.action_id === event.action_id
        )
      : [];

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-gray-400 truncate max-w-[200px]">
            {event.event_id}
          </span>
          <StatusBadge status={event.type} />
          <span className="text-xs text-gray-500">seq #{event.seq}</span>
        </div>
        <div className="text-xs text-gray-500">{formatTimestamp(event.timestamp)}</div>
      </div>

      <div className="px-5 py-4 space-y-5 max-h-[420px] overflow-y-auto">
        {/* Source */}
        {event.source_id && (
          <div>
            <SectionHeader>Source</SectionHeader>
            <Row label="source_id">
              <span className="font-mono text-cyan-400 text-xs">{event.source_id}</span>
            </Row>
          </div>
        )}

        {/* agent_action */}
        {event.type === 'agent_action' && (
          <div>
            <SectionHeader>Agent Action</SectionHeader>
            {event.tool && <Row label="tool">{event.tool}</Row>}
            {event.metadata.args_summary && (
              <div className="mt-2">
                <div className="text-xs text-gray-500 mb-1">args_summary</div>
                <pre className="font-mono text-sm whitespace-pre-wrap break-all bg-black/40 p-3 rounded text-gray-300">
                  {String(event.metadata.args_summary)}
                </pre>
              </div>
            )}
            {event.metadata.rationale && (
              <div className="mt-2">
                <div className="text-xs text-gray-500 mb-1">rationale</div>
                <p className="text-sm text-gray-300 italic">
                  {String(event.metadata.rationale)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* policy_decision */}
        {event.type === 'policy_decision' && (
          <div>
            <SectionHeader>Policy Decision</SectionHeader>
            <Row label="rule_id">
              <span className="font-mono text-xs">{String(event.metadata.rule_id)}</span>
            </Row>
            <Row label="decision">
              <StatusBadge status={String(event.metadata.decision)} />
            </Row>
            {event.metadata.reason && (
              <Row label="reason">{String(event.metadata.reason)}</Row>
            )}
            {Array.isArray(event.metadata.source_ids) &&
              event.metadata.source_ids.length > 0 && (
                <div className="mt-1">
                  <div className="text-xs text-gray-500 mb-1">source_ids</div>
                  <div className="flex flex-wrap gap-1">
                    {(event.metadata.source_ids as string[]).map((sid) => (
                      <span
                        key={sid}
                        className="font-mono text-xs text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded"
                      >
                        {sid}
                      </span>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}

        {/* tool_result */}
        {event.type === 'tool_result' && (
          <div>
            <SectionHeader>Tool Result</SectionHeader>
            <Row label="executed">
              {event.metadata.executed ? (
                <span className="text-cyan-400">✓ true</span>
              ) : (
                <span className="text-red-400">✗ false</span>
              )}
            </Row>
            {event.outcome && (
              <Row label="outcome">
                <StatusBadge status={event.outcome} />
              </Row>
            )}
            {/* data fields */}
            {event.metadata.data && typeof event.metadata.data === 'object' && (() => {
              const data = event.metadata.data as Record<string, unknown>;
              const displayValue =
                typeof data.content === 'string'
                  ? data.content
                  : typeof data.summary === 'string'
                  ? data.summary
                  : typeof data.redacted_payload === 'string'
                  ? data.redacted_payload
                  : null;
              return (
                <>
                  {displayValue && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-500 mb-1">data</div>
                      <pre className="font-mono text-sm whitespace-pre-wrap break-all bg-black/40 p-3 rounded text-gray-300">
                        {displayValue}
                      </pre>
                    </div>
                  )}
                  {typeof data.resolved_path === 'string' && (
                    <Row label="resolved_path">
                      <span className="font-mono text-xs text-gray-300">
                        {data.resolved_path}
                      </span>
                    </Row>
                  )}
                </>
              );
            })()}
            {event.metadata.error && (
              <Row label="error">
                <span className="text-red-400 text-xs font-mono">
                  {String(event.metadata.error)}
                </span>
              </Row>
            )}
          </div>
        )}

        {/* untrusted_input */}
        {event.type === 'untrusted_input' && (
          <div>
            <SectionHeader>Untrusted Input</SectionHeader>
            {event.metadata.origin && (
              <Row label="origin">{String(event.metadata.origin)}</Row>
            )}
            {event.metadata.source_type && (
              <Row label="source_type">{String(event.metadata.source_type)}</Row>
            )}
            {event.metadata.trust && (
              <Row label="trust">
                <StatusBadge status={String(event.metadata.trust)} />
              </Row>
            )}
            {event.metadata.content_hash && (
              <Row label="content_hash">
                <span className="font-mono text-xs text-gray-400">
                  {String(event.metadata.content_hash)}
                </span>
              </Row>
            )}
          </div>
        )}

        {/* evaluation_result */}
        {event.type === 'evaluation_result' && (
          <div>
            <SectionHeader>Evaluation Result</SectionHeader>
            {Array.isArray(event.metadata.checks) && (
              <div className="overflow-x-auto mt-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left text-gray-400 font-semibold pb-2 pr-4">
                        Label
                      </th>
                      <th className="text-left text-gray-400 font-semibold pb-2 pr-4">
                        Result
                      </th>
                      <th className="text-left text-gray-400 font-semibold pb-2">
                        Detail
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      event.metadata.checks as Array<{
                        id: string;
                        label: string;
                        result: string;
                        detail: string;
                      }>
                    ).map((check) => (
                      <tr key={check.id} className="border-t border-white/5">
                        <td className="py-1.5 pr-4 text-gray-300">{check.label}</td>
                        <td className="py-1.5 pr-4">
                          <StatusBadge status={check.result} />
                        </td>
                        <td className="py-1.5 text-gray-400">{check.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* run_failed */}
        {event.type === 'run_failed' && event.metadata.reason && (
          <div>
            <SectionHeader>Failure Reason</SectionHeader>
            <p className="text-sm text-red-400">{String(event.metadata.reason)}</p>
          </div>
        )}

        {/* Related events */}
        {relatedEvents.length > 0 && (
          <div>
            <SectionHeader>Related Events (same action)</SectionHeader>
            <div className="space-y-1">
              {relatedEvents.map((e) => (
                <div
                  key={e.event_id}
                  className="flex items-center gap-2 text-xs text-gray-400 py-1 border-b border-white/5"
                >
                  <span className="text-gray-500 font-mono">#{e.seq}</span>
                  <span className="text-gray-300">{e.type}</span>
                  {e.outcome && <StatusBadge status={e.outcome} />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
