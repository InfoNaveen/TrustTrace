import type { RunRecord, Event } from '@/lib/trusttrace/models';

// ============================================================
// In-memory singleton store (volatile, per-process)
// ============================================================
// DOCUMENTED LIMITATION: runs vanish on server restart and are not
// shared across processes. Use only in dev/test scenarios.

const runs = new Map<string, { record: RunRecord; events: Event[] }>();

export function createRun(record: RunRecord): void {
  runs.set(record.run_id, { record, events: [] });
}

export function getRun(id: string): { record: RunRecord; events: Event[] } | undefined {
  return runs.get(id);
}

export function updateRun(id: string, updates: Partial<RunRecord>): void {
  const entry = runs.get(id);
  if (!entry) return;
  entry.record = { ...entry.record, ...updates };
}

/**
 * Appends an event to the run's event list, assigning the next monotonic seq.
 * Returns the event with seq set.
 */
export function appendEvent(runId: string, event: Omit<Event, 'seq'>): Event {
  const entry = runs.get(runId);
  if (!entry) {
    throw new Error(`Run not found: ${runId}`);
  }
  const seq = entry.events.length;
  const stamped = { ...event, seq } as Event;
  entry.events.push(stamped);
  return stamped;
}

export function listEvents(runId: string): Event[] {
  return runs.get(runId)?.events ?? [];
}

/**
 * Clears all runs. For testing only.
 */
export function resetStoreForTesting(): void {
  runs.clear();
}

/**
 * MEDIUM-4: Insert a run with running status and no events, without starting the runner.
 * Guarded by TRUSTTRACE_TEST_HELPERS=1 environment variable.
 * Used by Test 9's 409 path to avoid racing the execution.
 */
export function createRunningRunForTesting(record: RunRecord): void {
  if (process.env.TRUSTTRACE_TEST_HELPERS !== '1') {
    throw new Error(
      'createRunningRunForTesting is only available when TRUSTTRACE_TEST_HELPERS=1'
    );
  }
  runs.set(record.run_id, { record: { ...record, status: 'running' }, events: [] });
}
