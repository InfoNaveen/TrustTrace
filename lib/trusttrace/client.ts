import type {
  AgentMode,
  RunStatus,
  Event,
  Evaluation,
  ScenarioPublic,
  RunRequest,
  Report,
} from './models';

// ============================================================
// Response types
// ============================================================

export interface HealthResponse {
  status: string;
  module: string;
  version: string;
  capabilities: {
    scripted: boolean;
    ollama: boolean;
  };
  ollama: {
    reachable: boolean;
    base_url: string;
    model: string;
    error: string | null;
  };
}

export interface RunResponse {
  run_id: string;
  scenario_id: string;
  agent_mode: AgentMode;
  protection_enabled: boolean;
  status: RunStatus;
  created_at: string;
  completed_at: string | null;
  events: Event[];
  evaluation: Evaluation | null;
}

export interface CreateRunResponse {
  run_id: string;
  status: 'running';
  created_at: string;
}

// ============================================================
// Error class
// ============================================================

export class TrustTraceApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'TrustTraceApiError';
    this.status = status;
  }
}

// ============================================================
// Base URL — empty string means same origin (Next.js API routes)
// ============================================================

const BASE = process.env.NEXT_PUBLIC_TRUSTTRACE_API_BASE ?? '';

// ============================================================
// Internal helper
// ============================================================

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  expectedStatus = 200
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });

  if (res.status !== expectedStatus && !res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore parse failures
    }
    throw new TrustTraceApiError(message, res.status);
  }

  // 409 special case for getReport
  if (res.status === 409) {
    throw new TrustTraceApiError('run not yet completed', 409);
  }

  return res.json() as Promise<T>;
}

// ============================================================
// API functions
// ============================================================

export async function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/api/trusttrace/health');
}

export async function getScenarios(): Promise<ScenarioPublic[]> {
  const data = await apiFetch<{ scenarios: ScenarioPublic[] }>(
    '/api/trusttrace/scenarios'
  );
  return data.scenarios;
}

export async function createRun(req: RunRequest): Promise<CreateRunResponse> {
  return apiFetch<CreateRunResponse>('/api/trusttrace/runs', {
    method: 'POST',
    body: JSON.stringify(req),
  }, 201);
}

export async function getRun(runId: string): Promise<RunResponse> {
  return apiFetch<RunResponse>(`/api/trusttrace/runs/${encodeURIComponent(runId)}`);
}

export async function getReport(runId: string): Promise<Report> {
  const res = await fetch(
    `${BASE}/api/trusttrace/runs/${encodeURIComponent(runId)}/report`,
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (res.status === 409) {
    throw new TrustTraceApiError('run not yet completed', 409);
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new TrustTraceApiError(message, res.status);
  }

  return res.json() as Promise<Report>;
}
