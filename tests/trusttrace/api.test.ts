import { describe, it, expect, beforeEach } from 'vitest';
import { resetStoreForTesting, getRun, createRunningRunForTesting } from '@/lib/trusttrace/store';
import { randomUUID } from 'node:crypto';
import type { RunRecord } from '@/lib/trusttrace/models';

// Set up test helpers env
process.env.TRUSTTRACE_TEST_HELPERS = '1';

// Import route handlers directly (in-process — no server boot)
import { GET as scenariosGET } from '@/app/api/trusttrace/scenarios/route';
import { POST as runsPost } from '@/app/api/trusttrace/runs/route';
import { GET as runGet } from '@/app/api/trusttrace/runs/[runId]/route';
import { GET as reportGet } from '@/app/api/trusttrace/runs/[runId]/report/route';

import { NextRequest } from 'next/server';

beforeEach(() => {
  resetStoreForTesting();
});

// Helper: poll store until run reaches a terminal status
async function waitForCompletion(runId: string, maxWaitMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const entry = getRun(runId);
    if (entry && (entry.record.status === 'completed' || entry.record.status === 'failed')) {
      return;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Run ${runId} did not complete within ${maxWaitMs}ms`);
}

// Test 9a: GET /scenarios returns both scenario ids
describe('API Test 9a: GET /scenarios', () => {
  it('returns 200 with both scenario ids', async () => {
    const req = new NextRequest('http://localhost/api/trusttrace/scenarios');
    const res = await scenariosGET();
    expect(res.status).toBe(200);

    const body = await res.json() as { scenarios: Array<{ id: string }> };
    expect(Array.isArray(body.scenarios)).toBe(true);
    const ids = body.scenarios.map((s) => s.id);
    expect(ids).toContain('repo-injection');
    expect(ids).toContain('benign-task');
  });
});

// Test 9b: POST /runs + GET /runs/:id + GET /runs/:id/report (200 after completion)
describe('API Test 9b: POST runs + GET run + GET report', () => {
  it('creates a run, completes it, and returns a 200 report', async () => {
    // POST a valid scripted benign-task run
    const postReq = new NextRequest('http://localhost/api/trusttrace/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario_id: 'benign-task',
        protection_enabled: true,
        agent_mode: 'scripted',
      }),
    });

    const postRes = await runsPost(postReq);
    expect(postRes.status).toBe(201);

    const postBody = await postRes.json() as { run_id: string; status: string; created_at: string };
    expect(postBody.status).toBe('running');
    expect(typeof postBody.run_id).toBe('string');
    expect(typeof postBody.created_at).toBe('string');

    const runId = postBody.run_id;

    // Poll until completed (scripted runs are near-instant)
    await waitForCompletion(runId);

    // GET run status
    const getReq = new NextRequest(`http://localhost/api/trusttrace/runs/${runId}`);
    const getRes = await runGet(getReq, { params: { runId } });
    expect(getRes.status).toBe(200);

    const getBody = await getRes.json() as Record<string, unknown>;
    expect(getBody.run_id).toBe(runId);
    expect(getBody.status).toBe('completed');
    expect(getBody.workspace_root).toBeUndefined(); // privacy: never returned
    expect(getBody.knownSecrets).toBeUndefined();    // privacy: never returned

    // GET report
    const reportReq = new NextRequest(`http://localhost/api/trusttrace/runs/${runId}/report`);
    const reportRes = await reportGet(reportReq, { params: { runId } });
    expect(reportRes.status).toBe(200);

    const reportBody = await reportRes.json() as Record<string, unknown>;
    expect(reportBody.run_id).toBe(runId);
    const evaluation = reportBody.evaluation as Record<string, unknown>;
    expect(evaluation.verdict).toBe('passed');
    expect(reportBody.workspace_root).toBeUndefined(); // privacy
    expect(reportBody.knownSecrets).toBeUndefined();    // privacy
  }, 30000);
});

// Test 9c: GET report before completion → 409 (MEDIUM-4)
describe('API Test 9c: Report returns 409 when run not completed', () => {
  it('returns 409 with correct shape for a running run', async () => {
    const runId = randomUUID();
    const record: RunRecord = {
      run_id: runId,
      scenario_id: 'benign-task',
      agent_mode: 'scripted',
      protection_enabled: true,
      status: 'running',
      created_at: new Date().toISOString(),
      completed_at: null,
      workspace_root: '',
      knownSecrets: [],
      ollama_config: null,
      error: null,
    };

    // Insert a running run without starting the runner (deterministic 409 — no race)
    createRunningRunForTesting(record);

    const reportReq = new NextRequest(`http://localhost/api/trusttrace/runs/${runId}/report`);
    const reportRes = await reportGet(reportReq, { params: { runId } });

    expect(reportRes.status).toBe(409);
    const body = await reportRes.json() as Record<string, unknown>;
    expect(body.run_id).toBe(runId);
    expect(body.status).toBe('running');
    expect(body.message).toBe('run not completed');
  });
});

// Test 9d: GET unknown run → 404
describe('API Test 9d: Unknown run returns 404', () => {
  it('returns 404 for a non-existent run', async () => {
    const unknownId = '00000000-0000-0000-0000-000000000000';
    const req = new NextRequest(`http://localhost/api/trusttrace/runs/${unknownId}`);
    const res = await runGet(req, { params: { runId: unknownId } });

    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Run not found');
  });

  it('returns 404 report for unknown run', async () => {
    const unknownId = '00000000-0000-0000-0000-000000000001';
    const req = new NextRequest(`http://localhost/api/trusttrace/runs/${unknownId}/report`);
    const res = await reportGet(req, { params: { runId: unknownId } });

    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Run not found');
  });
});
