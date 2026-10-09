import { describe, it, expect, beforeEach } from 'vitest';
import { resetStoreForTesting } from '@/lib/trusttrace/store';
import { resolveAndContainPath, evaluateAction } from '@/lib/trusttrace/policy';
import type { PolicyCtx } from '@/lib/trusttrace/policy';
import { executeAction } from '@/lib/trusttrace/tools';
import type { ToolCtx } from '@/lib/trusttrace/tools';
import type { AgentActionRequest, Event } from '@/lib/trusttrace/models';
import { createProvenanceRegistry } from '@/lib/trusttrace/provenance';
import { getScenario } from '@/lib/trusttrace/scenarios';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

beforeEach(() => {
  resetStoreForTesting();
});

// Helper: make a minimal appendEvent function for tests
function makeAppendEvent(): [(e: Omit<Event, 'seq'>) => Event, Event[]] {
  const events: Event[] = [];
  return [
    (e: Omit<Event, 'seq'>) => {
      const stamped = { ...e, seq: events.length } as Event;
      events.push(stamped);
      return stamped;
    },
    events,
  ];
}

// Test 1: Permitted file read returns expected content
describe('Policy Test 1: Permitted file read', () => {
  it('returns expected content when reading a permitted file', async () => {
    const testDir = path.join(os.tmpdir(), 'trusttrace-test', randomUUID());
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'allowed.txt'), 'Hello World Content', 'utf8');

    const scenario = getScenario('benign-task')!;
    const registry = createProvenanceRegistry();
    const [appendEv] = makeAppendEvent();

    const action: AgentActionRequest = {
      action_id: randomUUID(),
      run_id: randomUUID(),
      tool: 'read_repository_file',
      args: { path: 'allowed.txt' },
      source_ids: [],
    };

    const ctx: ToolCtx = {
      scenario: {
        ...scenario,
        permitted_read_paths: ['allowed.txt'],
        protected_paths: [],
      },
      workspaceRoot: testDir,
      protectionEnabled: true,
      knownSecrets: [],
      registeredSources: registry,
      appendEvent: appendEv,
    };

    const result = await executeAction(action, ctx);

    expect(result.executed).toBe(true);
    expect(result.outcome).toBe('success');
    expect(result.data.content).toContain('Hello World Content');
    expect(JSON.stringify(result)).not.toContain('FAKE_SECRET');

    await fs.rm(testDir, { recursive: true, force: true });
  });
});

// Test 2: Protected-file request denied; secret not revealed
describe('Policy Test 2: Protected file denied', () => {
  it('denies read_protected_file when protection is enabled and keeps secret out of result', async () => {
    const testDir = path.join(os.tmpdir(), 'trusttrace-test', randomUUID());
    await fs.mkdir(path.join(testDir, 'secrets'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, 'secrets', 'protected.txt'),
      'FAKE_SECRET_DO_NOT_USE_9f3a7c1e4b2d8a0f\nThis is a simulated secret for testing only.',
      'utf8'
    );

    const scenario = getScenario('repo-injection')!;
    const registry = createProvenanceRegistry();
    const [appendEv] = makeAppendEvent();

    const action: AgentActionRequest = {
      action_id: randomUUID(),
      run_id: randomUUID(),
      tool: 'read_protected_file',
      args: { path: 'secrets/protected.txt' },
      source_ids: [],
    };

    const ctx: ToolCtx = {
      scenario,
      workspaceRoot: testDir,
      protectionEnabled: true,
      knownSecrets: ['FAKE_SECRET_DO_NOT_USE_9f3a7c1e4b2d8a0f'],
      registeredSources: registry,
      appendEvent: appendEv,
    };

    const result = await executeAction(action, ctx);

    expect(result.executed).toBe(false);
    expect(result.outcome).toBe('denied');
    expect(result.data.content).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('FAKE_SECRET_DO_NOT_USE');

    await fs.rm(testDir, { recursive: true, force: true });
  });
});

// Test 3: Simulated transmission denied; no external transmission recorded
describe('Policy Test 3: Transmission denied', () => {
  it('denies simulate_network_send when protection is enabled', async () => {
    const scenario = getScenario('repo-injection')!;
    const registry = createProvenanceRegistry();
    const [appendEv] = makeAppendEvent();

    const action: AgentActionRequest = {
      action_id: randomUUID(),
      run_id: randomUUID(),
      tool: 'simulate_network_send',
      args: { destination: 'https://example.test', payload: 'secret data' },
      source_ids: [],
    };

    const ctx: ToolCtx = {
      scenario,
      workspaceRoot: os.tmpdir(),
      protectionEnabled: true,
      knownSecrets: [],
      registeredSources: registry,
      appendEvent: appendEv,
    };

    const result = await executeAction(action, ctx);

    expect(result.executed).toBe(false);
    expect(result.outcome).toBe('denied');
    // transmitted must be absent or false — operation did not occur
    expect(result.data.transmitted).toBeFalsy();
  });
});

// Test 4: Unknown tool name cannot execute
describe('Policy Test 4: Unknown tool denied', () => {
  it('denies execution of an unknown tool', () => {
    const scenario = getScenario('benign-task')!;
    const registry = createProvenanceRegistry();

    // Cast through unknown to simulate what the model might send
    const action = {
      action_id: randomUUID(),
      run_id: randomUUID(),
      tool: 'unknown_tool',
      args: {},
      source_ids: [],
    } as unknown as AgentActionRequest;

    const policyCtx: PolicyCtx = {
      scenario,
      workspaceRoot: os.tmpdir(),
      protectionEnabled: true,
      registeredSources: registry,
    };

    const decision = evaluateAction(action, policyCtx);

    expect(decision.decision).toBe('deny');
    expect(['deny_tool_not_allowlisted', 'deny_unknown_action']).toContain(
      decision.rule_id
    );
  });
});

// Test 5: Path traversal rejected
describe('Policy Test 5: Path traversal rejected', () => {
  it('rejects all path traversal variants', () => {
    const testDir = path.join(os.tmpdir(), 'trusttrace-test-path');

    const cases = [
      { relPath: '../etc/passwd', desc: 'parent traversal (..)' },
      { relPath: '/etc/passwd', desc: 'POSIX absolute (/)' },
      { relPath: 'C:/foo', desc: 'Windows drive-absolute (C:/forward)' },
      { relPath: 'C:\\foo', desc: 'Windows drive-absolute (C:\\backslash)' },
    ];

    for (const { relPath } of cases) {
      const result = resolveAndContainPath(testDir, relPath);
      expect(result.ok).toBe(false);
    }
  });
});
