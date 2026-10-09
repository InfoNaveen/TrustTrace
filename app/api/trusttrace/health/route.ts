import { NextResponse } from 'next/server';
import { checkHealth } from '@/lib/trusttrace/ollama-adapter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const base_url =
    process.env.TRUSTTRACE_OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const model = process.env.TRUSTTRACE_OLLAMA_MODEL ?? 'qwen2.5:7b';

  // MEDIUM-1: pass model explicitly; never set model to null in response
  const { reachable, error } = await checkHealth(base_url, model, {
    timeoutMs: 2500,
  });

  return NextResponse.json({
    status: 'ok',
    module: 'trusttrace',
    version: '1.0.0',
    capabilities: { scripted: true, ollama: true },
    ollama: { reachable, base_url, model, error },
  });
}
