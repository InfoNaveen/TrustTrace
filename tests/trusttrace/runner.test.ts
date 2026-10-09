import { describe, it, expect, beforeEach } from 'vitest';
import { resetStoreForTesting, createRun, getRun } from '@/lib/trusttrace/store';
import { executeRun } from '@/lib/trusttrace/runner';
import type { RunRecord } from '@/lib/trusttrace/models';
import { randomUUID } from 'node:crypto';

beforeEach(() => {
  resetStoreForTesting();
});

// Test 7: Benign task succeeds with protection enabled
describe('Runner Test 7: Benign task scripted run', () => {
  it('completes with verdict=passed for benign-task with protection enabled', async () => {
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

    createRun(record);
    await executeRun(runId);

    const entry = getRun(runId);
    expect(entry).toBeDefined();

    const { record: finalRecord, events } = entry!;

    expect(finalRecord.status).toBe('completed');
    expect(finalRecord.agent_mode).toBe('scripted');

    // Find the evaluation_result event
    const evalEvent = events.find((e) => e.type === 'evaluation_result');
    expect(evalEvent).toBeDefined();

    const evaluation = evalEvent!.metadata as Record<string, unknown>;
    expect(evaluation.verdict).toBe('passed');
    expect(evaluation.legitimate_task_completed).toBe(true);
    expect(evaluation.forbidden_operation_occurred).toBe(false);
  }, 30000); // 30s timeout for file ops
});

// Test 10: Unavailable Ollama → controlled run_failed, no fallback
describe('Runner Test 10: Ollama unavailable → run_failed', () => {
  it('emits run_failed with status=failed when Ollama is unreachable', async () => {
    const runId = randomUUID();
    const record: RunRecord = {
      run_id: runId,
      scenario_id: 'repo-injection',
      agent_mode: 'ollama',
      protection_enabled: true,
      status: 'running',
      created_at: new Date().toISOString(),
      completed_at: null,
      workspace_root: '',
      knownSecrets: [],
      // Dead port — guaranteed unreachable
      ollama_config: {
        base_url: 'http://127.0.0.1:19999',
        model: 'test-model',
      },
      error: null,
    };

    createRun(record);

    // executeRun will throw on Ollama failure; that's expected
    try {
      await executeRun(runId);
    } catch {
      // Expected — runner throws on failure
    }

    const entry = getRun(runId);
    expect(entry).toBeDefined();

    const { record: finalRecord, events } = entry!;

    // Status must be failed (not running or completed)
    expect(finalRecord.status).toBe('failed');

    // agent_mode must NOT have switched to scripted (no silent fallback)
    expect(finalRecord.agent_mode).toBe('ollama');

    // error must be a safe string (not null, not a stack trace with eval/require)
    expect(finalRecord.error).not.toBeNull();
    expect(typeof finalRecord.error).toBe('string');

    // run_failed event must exist in the event log
    const failedEvent = events.find((e) => e.type === 'run_failed');
    expect(failedEvent).toBeDefined();
  }, 30000); // 30s timeout for connection attempts
});
