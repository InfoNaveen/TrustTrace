import { NextRequest, NextResponse } from 'next/server';
import { getRun, listEvents } from '@/lib/trusttrace/store';
import type { Evaluation, Event } from '@/lib/trusttrace/models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getEvaluationFromEvents(events: Event[]): Evaluation | null {
  const evalEvent = events.find((e) => e.type === 'evaluation_result');
  if (!evalEvent) return null;
  return evalEvent.metadata as unknown as Evaluation;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { runId: string } }
): Promise<NextResponse> {
  // Next 14.2.x: params is a plain synchronous object — do NOT await
  const { runId } = params;

  const entry = getRun(runId);
  if (!entry) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const { record } = entry;

  // Strip workspace_root and knownSecrets from the response (privacy invariant)
  const events = listEvents(runId);
  const evaluation = getEvaluationFromEvents(events);

  return NextResponse.json({
    run_id: record.run_id,
    scenario_id: record.scenario_id,
    agent_mode: record.agent_mode,
    protection_enabled: record.protection_enabled,
    status: record.status,
    created_at: record.created_at,
    completed_at: record.completed_at,
    events,
    evaluation,
  });
}
