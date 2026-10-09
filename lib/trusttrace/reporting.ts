import type {
  Report,
  Event,
  PolicyDecision,
  ToolResult,
  Evaluation,
  Trust,
} from '@/lib/trusttrace/models';
import { PolicyDecisionSchema, ToolResultSchema } from '@/lib/trusttrace/models';
import { getRun, listEvents } from '@/lib/trusttrace/store';
import { POLICY_RULES } from '@/lib/trusttrace/policy';
import { getScenario } from '@/lib/trusttrace/scenarios';

// ============================================================
// Known limitations (design §19)
// ============================================================

const KNOWN_LIMITATIONS: string[] = [
  'Simulated tools only — no real execution, real network, or real secrets. TrustTrace tests a policy boundary on simulated tools, not real tool implementations.',
  'In-memory store vanishes on restart and is not shared across instances/processes. No persistence.',
  'Provenance ≠ causation. Source→action association is evidence of tracked exposure, not proof the input caused the action.',
  'TrustTrace does NOT prevent all prompt injection. It measures one specific boundary on specific scenarios; it is a harness, not a defense.',
  'Model explanations are not authoritative security evidence. Verdicts come solely from actual tool outcomes.',
  'Ollama-backed runs require a local Ollama instance. If unavailable, only the failure path is verified.',
  'Scripted mode is deterministic testing, not a demonstration of LLM behavior or security.',
];

// ============================================================
// buildReport
// ============================================================

/**
 * Assembles a full structured evidence report from the in-memory store.
 * Privacy: workspace_root and knownSecrets are NEVER included.
 */
export function buildReport(runId: string): Report {
  const entry = getRun(runId);
  if (!entry) {
    throw new Error(`Run not found: ${runId}`);
  }
  const { record } = entry;
  const events = listEvents(runId);

  const scenario = getScenario(record.scenario_id);
  const scenarioName = scenario?.name ?? record.scenario_id;

  // event_trace: all events in seq order (already ordered by store)
  const event_trace = [...events];

  // Extract policy_decision events and parse as PolicyDecision
  const policy_decisions: PolicyDecision[] = events
    .filter((e): e is Extract<Event, { type: 'policy_decision' }> => e.type === 'policy_decision')
    .map((e) => {
      const meta = e.metadata as Record<string, unknown>;
      const raw: PolicyDecision = {
        action_id: e.action_id ?? '',
        tool: e.tool!,
        source_ids: (meta.source_ids as string[]) ?? [],
        rule_id: meta.rule_id as PolicyDecision['rule_id'],
        decision: meta.decision as PolicyDecision['decision'],
        reason: meta.reason as string,
        timestamp: e.timestamp,
      };
      return PolicyDecisionSchema.parse(raw);
    });

  // Extract tool_result events and parse as ToolResult
  const tool_outcomes: ToolResult[] = events
    .filter((e): e is Extract<Event, { type: 'tool_result' }> => e.type === 'tool_result')
    .map((e) => {
      const meta = e.metadata as Record<string, unknown>;
      const raw: ToolResult = {
        action_id: e.action_id ?? '',
        tool: e.tool!,
        executed: meta.executed as boolean,
        outcome: e.outcome!,
        data: (meta.data as ToolResult['data']) ?? {},
        error: (meta.error as string | null) ?? null,
        timestamp: e.timestamp,
      };
      return ToolResultSchema.parse(raw);
    });

  // Build source_to_action map
  const sourceToActionMap = new Map<
    string,
    { origin: string; trust: Trust; action_ids: Set<string> }
  >();

  // Register sources from untrusted_input events
  for (const e of events) {
    if (e.type === 'untrusted_input' && e.source_id) {
      const meta = e.metadata as Record<string, unknown>;
      if (!sourceToActionMap.has(e.source_id)) {
        sourceToActionMap.set(e.source_id, {
          origin: meta.origin as string,
          trust: meta.trust as Trust,
          action_ids: new Set(),
        });
      }
    }
  }

  // Link agent_actions that reference source_ids
  for (const e of events) {
    if (e.type === 'agent_action' && e.source_id) {
      const entry2 = sourceToActionMap.get(e.source_id);
      if (entry2 && e.action_id) {
        entry2.action_ids.add(e.action_id);
      }
    }
  }

  const source_to_action = Array.from(sourceToActionMap.entries()).map(
    ([source_id, data]) => ({
      source_id,
      origin: data.origin,
      trust: data.trust,
      action_ids: Array.from(data.action_ids),
    })
  );

  // Extract evaluation from evaluation_result event
  const evalEvent = events.find((e) => e.type === 'evaluation_result');
  const evaluation = evalEvent
    ? (evalEvent.metadata as unknown as Evaluation)
    : ({
        verdict: 'inconclusive',
        forbidden_action_attempted: false,
        forbidden_operation_occurred: false,
        policy_denied: false,
        legitimate_task_completed: false,
        checks: [],
        reasoning: 'Evaluation not available',
        baseline_vs_protected_note: null,
      } as Evaluation);

  // Derive failed_checks and missing_checks
  const checks = evaluation.checks ?? [];
  const failed_checks = checks
    .filter((c) => c.result === 'failed')
    .map((c) => c.id);
  const missing_checks = checks
    .filter((c) => c.result === 'not_performed')
    .map((c) => c.id);

  // rules_applied: ordered rule ids from POLICY_RULES
  const rules_applied = POLICY_RULES.map((r) => r.rule_id);

  return {
    run_id: record.run_id,
    scenario: { id: record.scenario_id, name: scenarioName },
    execution_mode: record.agent_mode,
    agent_identity: {
      type: record.agent_mode,
      model: record.ollama_config?.model ?? null,
      base_url: record.ollama_config?.base_url ?? null,
    },
    protection_config: {
      protection_enabled: record.protection_enabled,
      rules_applied,
    },
    started_at: record.created_at,
    completed_at: record.completed_at,
    event_trace,
    source_to_action,
    policy_decisions,
    tool_outcomes,
    evaluation,
    failed_checks,
    missing_checks,
    known_limitations: KNOWN_LIMITATIONS,
  };
}
