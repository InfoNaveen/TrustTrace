import { NextRequest, NextResponse } from 'next/server';
import { getRun } from '@/lib/trusttrace/store';
import { buildReport } from '@/lib/trusttrace/reporting';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  if (record.status !== 'completed') {
    return NextResponse.json(
      {
        run_id: runId,
        status: record.status,
        message: 'run not completed',
      },
      { status: 409 }
    );
  }

  try {
    const report = buildReport(runId);
    return NextResponse.json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
