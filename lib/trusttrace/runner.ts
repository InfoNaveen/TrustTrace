import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import type { Event } from '@/lib/trusttrace/models';
import { updateRun, appendEvent, listEvents, getRun } from '@/lib/trusttrace/store';
import { getScenario } from '@/lib/trusttrace/scenarios';
import { createProvenanceRegistry, sha256 } from '@/lib/trusttrace/provenance';
import { FAKE_SECRET_RE } from '@/lib/trusttrace/events';
import { executeAction as doExecuteAction } from '@/lib/trusttrace/tools';
import { createAgent } from '@/lib/trusttrace/agent';
import { evaluate } from '@/lib/trusttrace/evaluation';

// ============================================================
// Fixtures root (server-side path)
// ============================================================

const fixturesRoot = path.join(process.cwd(), 'lib', 'trusttrace', 'fixtures');

// ============================================================
// Helper: build an event without seq (store assigns it)
// ============================================================

type EventWithoutSeq = Omit<Event, 'seq'>;

function ev(runId: string, fields: Omit<EventWithoutSeq, 'event_id' | 'run_id' | 'timestamp'>): EventWithoutSeq {
  return {
    event_id: randomUUID(),
    run_id: runId,
    timestamp: new Date().toISOString(),
    ...fields,
  } as EventWithoutSeq;
}

// ============================================================
// startRun — fire-and-forget
// ============================================================

/**
 * Schedules executeRun as a detached promise.
 * The .catch handler handles fatal errors that escape executeRun.
 * Never throws from startRun itself.
 */
export function startRun(runId: string): void {
  void executeRun(runId).catch((err) => {
    // Fatal: executeRun threw unexpectedly (should not happen normally)
    const safeMsg = err instanceof Error ? err.message : String(err);
    console.error('[TrustTrace] Fatal runner error after executeRun:', safeMsg);
    // executeRun already updates status to failed in its catch block,
    // so nothing more to do here unless the run was never in the store.
  });
}

// ============================================================
// executeRun — the awaited body
// ============================================================

export async function executeRun(runId: string): Promise<void> {
  const entry = getRun(runId);
  if (!entry) throw new Error(`Run not found: ${runId}`);

  const record = entry.record;
  const scenario = getScenario(record.scenario_id);
  if (!scenario) throw new Error(`Scenario not found: ${record.scenario_id}`);

  const appendEv = (e: EventWithoutSeq): Event => appendEvent(runId, e);

  let workspaceRoot = '';

  try {
    // Step 2: Materialize temp workspace
    workspaceRoot = path.join(os.tmpdir(), 'trusttrace', runId);
    await fs.mkdir(workspaceRoot, { recursive: true });
    await fs.cp(
      path.join(fixturesRoot, scenario.fixture_dir),
      workspaceRoot,
      { recursive: true }
    );

    // Step 3: Store workspace_root on RunRecord (server-side only; never returned by API)
    updateRun(runId, { workspace_root: workspaceRoot });

    // Step 4: Populate knownSecrets (MEDIUM-2)
    // Runner reads protected fixture files directly — NOT an agent tool call.
    // This does NOT set forbidden_operation_occurred.
    const knownSecrets: string[] = [];
    for (const protectedPath of scenario.protected_paths) {
      try {
        const absPath = path.join(workspaceRoot, protectedPath);
        const content = await fs.readFile(absPath, 'utf8');
        // Extract all strings matching FAKE_SECRET pattern (regex layer)
        const re = new RegExp(FAKE_SECRET_RE.source, 'g');
        const matches = content.match(re);
        if (matches) {
          for (const m of matches) {
            if (!knownSecrets.includes(m)) knownSecrets.push(m);
          }
        }
        // Also add full non-empty lines as exact-string fallback
        const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 4);
        for (const line of lines) {
          if (!knownSecrets.includes(line)) {
            knownSecrets.push(line);
          }
        }
      } catch {
        // Protected file not accessible — skip
      }
    }
    updateRun(runId, { knownSecrets });

    // Step 5: Register provenance sources (MEDIUM-3)
    // Runner registers EXACTLY the sources declared in scenario.sources.
    const registry = createProvenanceRegistry();

    for (const src of scenario.sources) {
      const originPath = path.join(workspaceRoot, src.origin);
      let contentHash: string | undefined;
      try {
        const content = await fs.readFile(originPath, 'utf8');
        contentHash = sha256(content);
      } catch {
        // File may not exist; content_hash omitted
      }

      registry.registerSource({
        source_id: src.source_id,
        source_type: src.source_type,
        origin: src.origin,
        trust: 'untrusted',
        content_hash: contentHash,
        timestamp: new Date().toISOString(),
        metadata: {},
      });
    }

    // Register the scenario objective as a scenario-type source (untrusted)
    const objectiveSourceId = `src_objective_${runId.slice(0, 8)}`;
    registry.registerSource({
      source_id: objectiveSourceId,
      source_type: 'scenario',
      origin: scenario.id,
      trust: 'untrusted',
      timestamp: new Date().toISOString(),
      metadata: {},
    });

    // Register system prompt as trusted source
    registry.registerSource({
      source_id: `src_system_${runId.slice(0, 8)}`,
      source_type: 'system',
      origin: 'system_prompt',
      trust: 'trusted',
      timestamp: new Date().toISOString(),
      metadata: {},
    });

    // Step 6: Emit run_started
    appendEv(ev(runId, {
      type: 'run_started',
      metadata: {
        scenario_id: scenario.id,
        agent_mode: record.agent_mode,
        protection_enabled: record.protection_enabled,
      },
    }));

    // Step 7: Emit untrusted_input events for each registered untrusted source
    for (const source of registry.listSources()) {
      if (source.trust === 'untrusted') {
        appendEv(ev(runId, {
          type: 'untrusted_input',
          source_id: source.source_id,
          metadata: {
            source_type: source.source_type,
            origin: source.origin,
            trust: source.trust,
            ...(source.content_hash ? { content_hash: source.content_hash } : {}),
          },
        }));
      }
    }

    // Step 8: Build ToolCtx with knownSecrets populated (before agent loop)
    const toolCtx = {
      scenario,
      workspaceRoot,
      protectionEnabled: record.protection_enabled,
      knownSecrets,
      registeredSources: registry,
      appendEvent: appendEv,
    };

    // Step 9: Create and run agent
    const ollamaConfig =
      record.agent_mode === 'ollama' && record.ollama_config
        ? {
            baseUrl: record.ollama_config.base_url,
            model: record.ollama_config.model,
          }
        : undefined;

    const agent = createAgent(record.agent_mode, {
      executeAction: doExecuteAction,
      scenario,
      runId,
      workspaceRoot,
      protectionEnabled: record.protection_enabled,
      knownSecrets,
      registeredSources: registry,
      appendEvent: appendEv,
      ollamaConfig,
    });

    // No-silent-fallback: Ollama errors propagate to this try/catch → run_failed
    await agent.run();

    // Step 10: Evaluate and emit evaluation_result
    const currentEvents = listEvents(runId);
    // Re-read record in case it was updated
    const latestRecord = getRun(runId)!.record;
    const evaluation = evaluate(scenario, latestRecord, currentEvents);

    appendEv(ev(runId, {
      type: 'evaluation_result',
      metadata: evaluation as unknown as Record<string, unknown>,
    }));

    // Step 11: Emit run_completed and update status
    const completedAt = new Date().toISOString();
    appendEv(ev(runId, {
      type: 'run_completed',
      metadata: { status: 'completed' },
    }));

    updateRun(runId, { status: 'completed', completed_at: completedAt });
  } catch (err) {
    // Handle run failure (including Ollama errors — no silent fallback to scripted)
    const safeMsg = err instanceof Error ? err.message : String(err);
    const failedAt = new Date().toISOString();

    console.error('[TrustTrace] executeRun failed:', safeMsg);

    try {
      appendEv(ev(runId, {
        type: 'run_failed',
        metadata: { reason: safeMsg },
      }));
    } catch {
      // Store append may fail if run was never properly initialized
    }

    updateRun(runId, {
      status: 'failed',
      error: safeMsg,
      completed_at: failedAt,
    });

    // Re-throw so startRun's .catch also sees it (for logging)
    throw err;
  } finally {
    // Step 12: Always clean up temp workspace
    if (workspaceRoot) {
      try {
        await fs.rm(workspaceRoot, { recursive: true, force: true });
      } catch {
        console.warn('[TrustTrace] Failed to clean up workspace:', workspaceRoot);
      }
    }
  }
}
