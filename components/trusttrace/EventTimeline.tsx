'use client';

import {
  Shield,
  AlertTriangle,
  Cpu,
  Wrench,
  Lock,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  FileText,
} from 'lucide-react';
import type { Event } from '@/lib/trusttrace/models';
import { StatusBadge } from '@/components/trusttrace/StatusBadge';

// ============================================================
// EventTimeline
// ============================================================

interface EventTimelineProps {
  events: Event[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
}

interface IconInfo {
  Icon: React.ComponentType<{ className?: string; size?: number }>;
  colorClass: string;
}

function getEventIcon(event: Event): IconInfo {
  switch (event.type) {
    case 'run_started':
    case 'run_completed':
      return { Icon: Shield, colorClass: 'text-cyan-400' };
    case 'untrusted_input':
      return { Icon: AlertTriangle, colorClass: 'text-amber-400' };
    case 'agent_action':
      return { Icon: Cpu, colorClass: 'text-violet-400' };
    case 'tool_attempt':
      return { Icon: Wrench, colorClass: 'text-gray-400' };
    case 'policy_decision': {
      const decision = (event.metadata as { decision?: string }).decision;
      if (decision === 'deny') {
        return { Icon: ShieldAlert, colorClass: 'text-red-400' };
      }
      return { Icon: Lock, colorClass: 'text-cyan-400' };
    }
    case 'tool_result': {
      const executed = (event.metadata as { executed?: boolean }).executed;
      if (executed === false) {
        return { Icon: XCircle, colorClass: 'text-red-400' };
      }
      return { Icon: CheckCircle2, colorClass: 'text-cyan-400' };
    }
    case 'run_failed':
      return { Icon: XCircle, colorClass: 'text-red-400' };
    case 'evaluation_result':
      return { Icon: FileText, colorClass: 'text-violet-400' };
    default:
      return { Icon: Shield, colorClass: 'text-gray-400' };
  }
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return ts;
  }
}

export function EventTimeline({
  events,
  selectedEventId,
  onSelectEvent,
}: EventTimelineProps) {
  if (events.length === 0) {
    return (
      <div
        role="list"
        aria-label="Event timeline"
        className="glass-panel rounded-xl p-4"
      >
        <div className="flex items-center gap-2 text-amber-400 text-sm py-4 justify-center">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          No events yet — run in progress…
        </div>
      </div>
    );
  }

  return (
    <div
      role="list"
      aria-label="Event timeline"
      className="glass-panel rounded-xl overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-white/5">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Event Timeline
        </span>
      </div>
      <div className="divide-y divide-white/5 max-h-[480px] overflow-y-auto">
        {events.map((event) => {
          const { Icon, colorClass } = getEventIcon(event);
          const isSelected = event.event_id === selectedEventId;
          const tool = event.tool;
          const outcome = event.outcome;

          return (
            <button
              key={event.event_id}
              role="listitem"
              aria-label={`Select event ${event.seq}`}
              onClick={() => onSelectEvent(event.event_id)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors ${
                isSelected
                  ? 'border-l-2 border-cyan-400 bg-white/5 pl-[14px]'
                  : 'border-l-2 border-transparent'
              }`}
            >
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                <Icon className={colorClass} size={16} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500 font-mono">
                    #{event.seq}
                  </span>
                  <span className="text-sm text-white font-medium">
                    {event.type}
                  </span>
                  {outcome && <StatusBadge status={outcome} />}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(event.timestamp)}
                  </span>
                  {tool && (
                    <span className="text-xs text-cyan-400 font-mono">
                      {tool}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
