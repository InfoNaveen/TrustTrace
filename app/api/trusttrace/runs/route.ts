import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { RunRequestSchema } from '@/lib/trusttrace/models';
import type { RunRecord } from '@/lib/trusttrace/models';
import { createRun } from '@/lib/trusttrace/store';
import { getScenario } from '@/lib/trusttrace/scenarios';
import { startRun } from '@/lib/trusttrace/runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RunRequestSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    return NextResponse.json(
      { error: `Invalid request: ${detail}` },
      { status: 400 }
    );
  }

  const req = parsed.data;

  // Validate scenario_id
  const scenario = getScenario(req.scenario_id);
  if (!scenario) {
    return NextResponse.json({ error: 'Unknown scenario_id' }, { status: 400 });
  }

  // Resolve Ollama config (never silently fall back to scripted)
  let ollamaConfig: { base_url: string; model: string } | null = null;
  if (req.agent_mode === 'ollama') {
    ollamaConfig = {
      base_url:
        req.ollama?.base_url ??
        process.env.TRUSTTRACE_OLLAMA_BASE_URL ??
        'http://localhost:11434',
      model:
        req.ollama?.model ??
        process.env.TRUSTTRACE_OLLAMA_MODEL ??
        'qwen2.5:7b',
    };
  }

  const run_id = randomUUID();
  const created_at = new Date().toISOString();

  const record: RunRecord = {
    run_id,
    scenario_id: req.scenario_id,
    agent_mode: req.agent_mode,
    protection_enabled: req.protection_enabled,
    status: 'running',
    created_at,
    completed_at: null,
    workspace_root: '', // set by runner after materialization
    knownSecrets: [], // populated by runner before agent loop
    ollama_config: ollamaConfig,
    error: null,
  };

  createRun(record);

  // Fire-and-forget — do NOT await
  startRun(run_id);

  return NextResponse.json(
    { run_id, status: 'running', created_at },
    { status: 201 }
  );
}
