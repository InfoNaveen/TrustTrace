import fs from 'node:fs/promises';
import { z } from 'zod';
import type { AgentActionRequest, Event, ToolResult, Scenario } from '@/lib/trusttrace/models';
import { evaluateAction, resolveAndContainPath } from '@/lib/trusttrace/policy';
import { redactSecrets } from '@/lib/trusttrace/events';
import type { ProvenanceRegistry } from '@/lib/trusttrace/provenance';

// ============================================================
// Tool execution context
// ============================================================

export interface ToolCtx {
  scenario: Scenario;
  workspaceRoot: string;
  protectionEnabled: boolean;
  knownSecrets: string[];
  registeredSources: ProvenanceRegistry;
  appendEvent: (e: Omit<Event, 'seq'>) => Event;
}

// ============================================================
// Arg schemas (mirrored here for execution-time validation)
// ============================================================

const READ_FILE_ARGS = z.strictObject({ path: z.string().min(1) });
const NETWORK_SEND_ARGS = z.strictObject({
  destination: z.string().min(1),
  payload: z.string(),
});
const COMPLETE_TASK_ARGS = z.strictObject({
  summary: z.string().min(1).max(2000),
});

// ============================================================
// The ONLY execution path — enforces policy before running any tool
// ============================================================

/**
 * executeAction is the sole gateway for tool execution.
 *
 * Invariant:
 *   decision === 'deny'  → underlying tool does NOT run; executed=false
 *   decision === 'allow' → tool runs; executed=true (unless runtime error)
 */
export async function executeAction(
  action: AgentActionRequest,
  ctx: ToolCtx
): Promise<ToolResult> {
  const now = () => new Date().toISOString();

  // 1. Emit tool_attempt event (args_validated after parse attempt below)
  let argsValidated = false;
  try {
    if (
      action.tool === 'read_repository_file' ||
      action.tool === 'read_protected_file'
    ) {
      READ_FILE_ARGS.parse(action.args);
      argsValidated = true;
    } else if (action.tool === 'simulate_network_send') {
      NETWORK_SEND_ARGS.parse(action.args);
      argsValidated = true;
    } else if (action.tool === 'complete_task') {
      COMPLETE_TASK_ARGS.parse(action.args);
      argsValidated = true;
    }
  } catch {
    argsValidated = false;
  }

  ctx.appendEvent({
    event_id: crypto.randomUUID(),
    run_id: action.run_id,
    timestamp: now(),
    action_id: action.action_id,
    tool: action.tool,
    type: 'tool_attempt',
    metadata: { args_validated: argsValidated },
  } as Omit<Event, 'seq'>);

  // 2. Evaluate policy
  const policyCtx = {
    scenario: ctx.scenario,
    workspaceRoot: ctx.workspaceRoot,
    protectionEnabled: ctx.protectionEnabled,
    registeredSources: ctx.registeredSources,
  };
  const decision = evaluateAction(action, policyCtx);

  // 3. Emit policy_decision event
  ctx.appendEvent({
    event_id: crypto.randomUUID(),
    run_id: action.run_id,
    timestamp: now(),
    action_id: action.action_id,
    tool: action.tool,
    type: 'policy_decision',
    metadata: {
      rule_id: decision.rule_id,
      decision: decision.decision,
      reason: decision.reason,
      source_ids: action.source_ids,
    },
  } as Omit<Event, 'seq'>);

  let result: ToolResult;

  // 4. Enforce policy decision
  if (decision.decision === 'deny') {
    // Tool does NOT run on deny
    result = {
      action_id: action.action_id,
      tool: action.tool,
      executed: false,
      outcome: 'denied',
      data: {},
      error: decision.reason,
      timestamp: now(),
    };
  } else {
    // 5. Execute the tool (only on allow)
    try {
      result = await runTool(action, ctx);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      result = {
        action_id: action.action_id,
        tool: action.tool,
        executed: false,
        outcome: 'error',
        data: {},
        error: redactSecrets(errMsg, ctx.knownSecrets),
        timestamp: now(),
      };
    }
  }

  // 6. Emit tool_result event
  ctx.appendEvent({
    event_id: crypto.randomUUID(),
    run_id: action.run_id,
    timestamp: now(),
    action_id: action.action_id,
    tool: action.tool,
    outcome: result.outcome,
    type: 'tool_result',
    metadata: {
      executed: result.executed,
      data: result.data,
      error: result.error,
    },
  } as Omit<Event, 'seq'>);

  return result;
}

// ============================================================
// Per-tool implementations (only called on allow)
// ============================================================

async function runTool(
  action: AgentActionRequest,
  ctx: ToolCtx
): Promise<ToolResult> {
  const now = () => new Date().toISOString();

  switch (action.tool) {
    case 'read_repository_file': {
      const args = READ_FILE_ARGS.parse(action.args);
      const contained = resolveAndContainPath(ctx.workspaceRoot, args.path);
      if (!contained.ok) {
        throw new Error(`Path rejected: ${contained.reason}`);
      }
      const raw = await fs.readFile(contained.absPath, 'utf8');
      const content = redactSecrets(raw, ctx.knownSecrets);
      return {
        action_id: action.action_id,
        tool: action.tool,
        executed: true,
        outcome: 'success',
        data: { content, resolved_path: contained.relPath },
        error: null,
        timestamp: now(),
      };
    }

    case 'read_protected_file': {
      // Only reached in baseline mode (!protectionEnabled); policy already checked
      const args = READ_FILE_ARGS.parse(action.args);
      const contained = resolveAndContainPath(ctx.workspaceRoot, args.path);
      if (!contained.ok) {
        throw new Error(`Path rejected: ${contained.reason}`);
      }
      const raw = await fs.readFile(contained.absPath, 'utf8');
      // Always redact — knownSecrets populated at run start
      const content = redactSecrets(raw, ctx.knownSecrets);
      return {
        action_id: action.action_id,
        tool: action.tool,
        executed: true,
        outcome: 'success',
        data: { content, resolved_path: contained.relPath },
        error: null,
        timestamp: now(),
      };
    }

    case 'simulate_network_send': {
      // ZERO network I/O — only records a redacted payload and sets transmitted=true
      const args = NETWORK_SEND_ARGS.parse(action.args);
      const redactedPayload = redactSecrets(
        `${args.destination} ${args.payload}`,
        ctx.knownSecrets
      );
      return {
        action_id: action.action_id,
        tool: action.tool,
        executed: true,
        outcome: 'success',
        data: { transmitted: true, redacted_payload: redactedPayload },
        error: null,
        timestamp: now(),
      };
    }

    case 'complete_task': {
      const args = COMPLETE_TASK_ARGS.parse(action.args);
      return {
        action_id: action.action_id,
        tool: action.tool,
        executed: true,
        outcome: 'success',
        data: { summary: redactSecrets(args.summary, ctx.knownSecrets) },
        error: null,
        timestamp: now(),
      };
    }

    default: {
      // Should never reach here — policy would have denied unknown tools
      const exhaustive: never = action.tool;
      throw new Error(`Unhandled tool: ${String(exhaustive)}`);
    }
  }
}
