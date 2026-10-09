import { z } from 'zod';

// ============================================================
// Enums and primitives
// ============================================================

export const AgentModeSchema = z.enum(['scripted', 'ollama']);
export type AgentMode = z.infer<typeof AgentModeSchema>;

export const RunStatusSchema = z.enum(['running', 'completed', 'failed']);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const DecisionSchema = z.enum(['allow', 'deny']);
export type Decision = z.infer<typeof DecisionSchema>;

export const ToolNameSchema = z.enum([
  'read_repository_file',
  'read_protected_file',
  'simulate_network_send',
  'complete_task',
]);
export type ToolName = z.infer<typeof ToolNameSchema>;

export const SourceTypeSchema = z.enum(['fixture', 'scenario', 'agent', 'system']);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const TrustSchema = z.enum(['untrusted', 'trusted']);
export type Trust = z.infer<typeof TrustSchema>;

export const VerdictSchema = z.enum([
  'blocked',
  'attack_succeeded',
  'passed',
  'failed',
  'inconclusive',
]);
export type Verdict = z.infer<typeof VerdictSchema>;

export const ToolOutcomeSchema = z.enum(['success', 'denied', 'error']);
export type ToolOutcome = z.infer<typeof ToolOutcomeSchema>;

export const CheckResultSchema = z.enum(['passed', 'failed', 'not_performed']);
export type CheckResult = z.infer<typeof CheckResultSchema>;

export const RuleIdSchema = z.enum([
  'allow_read_permitted',
  'allow_complete_task',
  'allow_protected_read_baseline',
  'allow_transmit_baseline',
  'deny_tool_not_allowlisted',
  'deny_malformed',
  'deny_path_outside_workspace',
  'deny_unknown_action',
  'deny_read_protected',
  'deny_transmit_protected',
]);
export type RuleId = z.infer<typeof RuleIdSchema>;

// ============================================================
// RunRequest (POST /runs body)
// ============================================================

export const RunRequestSchema = z.strictObject({
  scenario_id: z.string().min(1),
  protection_enabled: z.boolean().default(true),
  agent_mode: AgentModeSchema,
  ollama: z
    .strictObject({
      base_url: z.string().url().optional(),
      model: z.string().min(1).optional(),
    })
    .optional(),
});
export type RunRequest = z.infer<typeof RunRequestSchema>;

// ============================================================
// RunRecord (server-side only; workspace_root/knownSecrets never returned)
// ============================================================

export const RunRecordSchema = z.object({
  run_id: z.string().uuid(),
  scenario_id: z.string(),
  agent_mode: AgentModeSchema,
  protection_enabled: z.boolean(),
  status: RunStatusSchema,
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
  workspace_root: z.string(), // internal; stripped from API responses
  knownSecrets: z.array(z.string()).default([]), // internal; never returned by API
  ollama_config: z
    .strictObject({ base_url: z.string(), model: z.string() })
    .nullable(),
  error: z.string().nullable(),
});
export type RunRecord = z.infer<typeof RunRecordSchema>;

// ============================================================
// ProvenanceLabel
// ============================================================

export const ProvenanceLabelSchema = z.strictObject({
  source_id: z.string(),
  source_type: SourceTypeSchema,
  origin: z.string(),
  trust: TrustSchema,
  content_hash: z.string().optional(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).default({}),
});
export type ProvenanceLabel = z.infer<typeof ProvenanceLabelSchema>;

// ============================================================
// Scenario schemas (internal) and ScenarioPublic (API projection)
// ============================================================

export const ScriptedActionSchema = z.strictObject({
  tool: ToolNameSchema,
  args: z.record(z.unknown()),
  source_ids: z.array(z.string()),
});
export type ScriptedAction = z.infer<typeof ScriptedActionSchema>;

export const ScenarioSourceSchema = z.strictObject({
  source_id: z.string(),
  source_type: SourceTypeSchema,
  origin: z.string(),
});
export type ScenarioSource = z.infer<typeof ScenarioSourceSchema>;

export const ScenarioSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tools: z.array(ToolNameSchema),
  simulated: z.boolean(),
  expected_invariant: z.string(),
  expected_legitimate_behavior: z.string(),
  evaluation_criteria: z.string(),
  fixture_dir: z.string(),
  protected_paths: z.array(z.string()),
  permitted_read_paths: z.array(z.string()),
  forbidden_attempt_tools: z.array(ToolNameSchema),
  objective: z.string(),
  sources: z.array(ScenarioSourceSchema),
  scripted_actions: z.array(ScriptedActionSchema),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const ScenarioPublicSchema = ScenarioSchema.pick({
  id: true,
  name: true,
  description: true,
  tools: true,
  simulated: true,
  expected_invariant: true,
  expected_legitimate_behavior: true,
  evaluation_criteria: true,
}).strip();
export type ScenarioPublic = z.infer<typeof ScenarioPublicSchema>;

// ============================================================
// AgentActionRequest
// ============================================================

export const AgentActionRequestSchema = z.strictObject({
  action_id: z.string().uuid(),
  run_id: z.string().uuid(),
  tool: ToolNameSchema,
  args: z.record(z.unknown()),
  source_ids: z.array(z.string()),
  rationale: z.string().max(2000).optional(),
});
export type AgentActionRequest = z.infer<typeof AgentActionRequestSchema>;

// ============================================================
// PolicyRule and PolicyDecision
// ============================================================

export const PolicyRuleSchema = z.strictObject({
  rule_id: RuleIdSchema,
  description: z.string(),
  effect: DecisionSchema,
  always_on: z.boolean(),
});
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

export const PolicyDecisionSchema = z.strictObject({
  action_id: z.string().uuid(),
  tool: ToolNameSchema,
  source_ids: z.array(z.string()),
  rule_id: RuleIdSchema,
  decision: DecisionSchema,
  reason: z.string(),
  timestamp: z.string().datetime(),
});
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;

// ============================================================
// ToolResult
// ============================================================

export const ToolResultDataSchema = z.strictObject({
  content: z.string().optional(),
  transmitted: z.boolean().optional(),
  redacted_payload: z.string().optional(),
  summary: z.string().optional(),
  resolved_path: z.string().optional(),
});
export type ToolResultData = z.infer<typeof ToolResultDataSchema>;

export const ToolResultSchema = z.strictObject({
  action_id: z.string().uuid(),
  tool: ToolNameSchema,
  executed: z.boolean(),
  outcome: ToolOutcomeSchema,
  data: ToolResultDataSchema.default({}),
  error: z.string().nullable(),
  timestamp: z.string().datetime(),
});
export type ToolResult = z.infer<typeof ToolResultSchema>;

// ============================================================
// Event (discriminated union)
// ============================================================

const EventBase = z.object({
  event_id: z.string().uuid(),
  run_id: z.string().uuid(),
  seq: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
  source_id: z.string().optional(),
  action_id: z.string().uuid().optional(),
  tool: ToolNameSchema.optional(),
  outcome: ToolOutcomeSchema.optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const EventSchema = z.discriminatedUnion('type', [
  EventBase.extend({
    type: z.literal('run_started'),
    metadata: z.strictObject({
      scenario_id: z.string(),
      agent_mode: AgentModeSchema,
      protection_enabled: z.boolean(),
    }),
  }),
  EventBase.extend({
    type: z.literal('untrusted_input'),
    metadata: z.strictObject({
      source_type: SourceTypeSchema,
      origin: z.string(),
      trust: TrustSchema,
      content_hash: z.string().optional(),
    }),
  }),
  EventBase.extend({
    type: z.literal('agent_action'),
    metadata: z.strictObject({
      args_summary: z.string(),
      rationale: z.string().optional(),
    }),
  }),
  EventBase.extend({
    type: z.literal('tool_attempt'),
    metadata: z.strictObject({ args_validated: z.boolean() }),
  }),
  EventBase.extend({
    type: z.literal('policy_decision'),
    metadata: z.strictObject({
      rule_id: RuleIdSchema,
      decision: DecisionSchema,
      reason: z.string(),
      source_ids: z.array(z.string()),
    }),
  }),
  EventBase.extend({
    type: z.literal('tool_result'),
    metadata: z.strictObject({
      executed: z.boolean(),
      data: ToolResultDataSchema,
      error: z.string().nullable(),
    }),
  }),
  EventBase.extend({
    type: z.literal('run_completed'),
    metadata: z.strictObject({ status: z.literal('completed') }),
  }),
  EventBase.extend({
    type: z.literal('run_failed'),
    metadata: z.strictObject({ reason: z.string() }),
  }),
  EventBase.extend({
    type: z.literal('evaluation_result'),
    metadata: z.record(z.unknown()),
  }),
]);
export type Event = z.infer<typeof EventSchema>;

// ============================================================
// Evaluation and Report
// ============================================================

export const CheckSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  result: CheckResultSchema,
  detail: z.string(),
});
export type Check = z.infer<typeof CheckSchema>;

export const EvaluationSchema = z.strictObject({
  verdict: VerdictSchema,
  forbidden_action_attempted: z.boolean(),
  forbidden_operation_occurred: z.boolean(),
  policy_denied: z.boolean(),
  legitimate_task_completed: z.boolean(),
  checks: z.array(CheckSchema),
  reasoning: z.string(),
  baseline_vs_protected_note: z.string().nullable(),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

export const ReportSchema = z.strictObject({
  run_id: z.string().uuid(),
  scenario: z.strictObject({ id: z.string(), name: z.string() }),
  execution_mode: AgentModeSchema,
  agent_identity: z.strictObject({
    type: AgentModeSchema,
    model: z.string().nullable(),
    base_url: z.string().nullable(),
  }),
  protection_config: z.strictObject({
    protection_enabled: z.boolean(),
    rules_applied: z.array(RuleIdSchema),
  }),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
  event_trace: z.array(EventSchema),
  source_to_action: z.array(
    z.strictObject({
      source_id: z.string(),
      origin: z.string(),
      trust: TrustSchema,
      action_ids: z.array(z.string()),
    })
  ),
  policy_decisions: z.array(PolicyDecisionSchema),
  tool_outcomes: z.array(ToolResultSchema),
  evaluation: EvaluationSchema,
  failed_checks: z.array(z.string()),
  missing_checks: z.array(z.string()),
  known_limitations: z.array(z.string()),
});
export type Report = z.infer<typeof ReportSchema>;
