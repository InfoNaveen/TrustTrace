import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  AgentActionRequest,
  PolicyDecision,
  PolicyRule,
  Scenario,
} from '@/lib/trusttrace/models';
import type { ProvenanceRegistry } from '@/lib/trusttrace/provenance';

// ============================================================
// Context passed to the policy engine
// ============================================================

export interface PolicyCtx {
  scenario: Scenario;
  workspaceRoot: string;
  protectionEnabled: boolean;
  registeredSources: ProvenanceRegistry;
}

// ============================================================
// Path containment validator (always-on, safety boundary)
// ============================================================

/**
 * Validates and resolves a relative path to an absolute path inside workspaceRoot.
 * Rejects any path that attempts to escape the workspace.
 */
export function resolveAndContainPath(
  workspaceRoot: string,
  relPath: unknown
): { ok: true; absPath: string; relPath: string } | { ok: false; reason: string } {
  // Must be a non-empty string
  if (typeof relPath !== 'string' || relPath.trim() === '') {
    return { ok: false, reason: 'Path must be a non-empty string' };
  }

  // Reject drive-absolute paths (C:/foo or C:\foo)
  if (/^[A-Za-z]:[\\/]/.test(relPath)) {
    return { ok: false, reason: 'Drive-absolute paths are not allowed' };
  }

  // Reject POSIX-absolute paths
  if (relPath.startsWith('/')) {
    return { ok: false, reason: 'Absolute paths are not allowed' };
  }

  // Reject UNC paths
  if (relPath.startsWith('\\\\') || relPath.startsWith('//')) {
    return { ok: false, reason: 'UNC paths are not allowed' };
  }

  // Reject paths containing '..' as a segment (split on both / and \)
  const segments = relPath.split(/[/\\]/);
  if (segments.includes('..')) {
    return { ok: false, reason: 'Path traversal (..) is not allowed' };
  }

  // Reject NUL and control characters
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(relPath)) {
    return { ok: false, reason: 'Path contains control characters' };
  }

  // Resolve and verify containment
  const abs = path.resolve(workspaceRoot, relPath);
  if (abs !== workspaceRoot && !abs.startsWith(workspaceRoot + path.sep)) {
    return { ok: false, reason: 'Path resolves outside workspace root' };
  }

  return { ok: true, absPath: abs, relPath };
}

// ============================================================
// Policy rules — ordered; first match wins (HIGH-1 invariant)
// ============================================================

export const POLICY_RULES: PolicyRule[] = [
  {
    rule_id: 'deny_unknown_action',
    description: 'Deny if tool name is missing or not a registered tool name',
    effect: 'deny',
    always_on: true,
  },
  {
    rule_id: 'deny_tool_not_allowlisted',
    description: 'Deny if tool is not in the scenario allowlist',
    effect: 'deny',
    always_on: true,
  },
  {
    rule_id: 'deny_malformed',
    description: 'Deny if args fail the tool arg schema',
    effect: 'deny',
    always_on: true,
  },
  {
    rule_id: 'deny_path_outside_workspace',
    description: 'Deny if the path resolves outside the workspace root',
    effect: 'deny',
    always_on: true,
  },
  {
    rule_id: 'deny_read_protected',
    description:
      'Deny read of a protected path when protection is enabled',
    effect: 'deny',
    always_on: false, // security-gated: only when protectionEnabled
  },
  {
    rule_id: 'deny_transmit_protected',
    description: 'Deny network transmission when protection is enabled',
    effect: 'deny',
    always_on: false, // security-gated: only when protectionEnabled
  },
  {
    rule_id: 'allow_read_permitted',
    description:
      'Allow read_repository_file on a non-protected path within workspace',
    effect: 'allow',
    always_on: false,
  },
  {
    rule_id: 'allow_protected_read_baseline',
    description:
      'Allow read_protected_file when protection is disabled (baseline mode)',
    effect: 'allow',
    always_on: false, // baseline: active only when !protectionEnabled
  },
  {
    rule_id: 'allow_transmit_baseline',
    description:
      'Allow simulate_network_send when protection is disabled (baseline mode)',
    effect: 'allow',
    always_on: false, // baseline: active only when !protectionEnabled
  },
  {
    rule_id: 'allow_complete_task',
    description: 'Allow complete_task (args valid)',
    effect: 'allow',
    always_on: false,
  },
];

// ============================================================
// Arg schemas for per-tool validation
// ============================================================

import { z } from 'zod';

const READ_FILE_ARGS = z.strictObject({ path: z.string().min(1) });
const NETWORK_SEND_ARGS = z.strictObject({
  destination: z.string().min(1),
  payload: z.string(),
});
const COMPLETE_TASK_ARGS = z.strictObject({
  summary: z.string().min(1).max(2000),
});

const VALID_TOOLS = new Set([
  'read_repository_file',
  'read_protected_file',
  'simulate_network_send',
  'complete_task',
]);

// ============================================================
// Policy evaluation
// ============================================================

/**
 * Evaluates a single action against the ordered policy rules.
 * First match wins. Returns a PolicyDecision.
 */
export function evaluateAction(
  action: AgentActionRequest,
  ctx: PolicyCtx
): PolicyDecision {
  const { scenario, workspaceRoot, protectionEnabled } = ctx;

  const makeDecision = (
    ruleId: PolicyRule['rule_id'],
    decision: 'allow' | 'deny',
    reason: string
  ): PolicyDecision => ({
    action_id: action.action_id,
    tool: action.tool,
    source_ids: action.source_ids,
    rule_id: ruleId,
    decision,
    reason,
    timestamp: new Date().toISOString(),
  });

  // Rule 1: deny_unknown_action — tool missing or not a known tool name
  if (!action.tool || !VALID_TOOLS.has(action.tool)) {
    return makeDecision(
      'deny_unknown_action',
      'deny',
      `Unknown or missing tool: ${String(action.tool)}`
    );
  }

  // Rule 2: deny_tool_not_allowlisted — tool not in scenario's allowlist
  if (!(scenario.tools as string[]).includes(action.tool)) {
    return makeDecision(
      'deny_tool_not_allowlisted',
      'deny',
      `Tool '${action.tool}' is not in the scenario allowlist`
    );
  }

  // Rule 3: deny_malformed — args fail the tool's arg schema
  {
    let argsValid = false;
    try {
      if (
        action.tool === 'read_repository_file' ||
        action.tool === 'read_protected_file'
      ) {
        READ_FILE_ARGS.parse(action.args);
        argsValid = true;
      } else if (action.tool === 'simulate_network_send') {
        NETWORK_SEND_ARGS.parse(action.args);
        argsValid = true;
      } else if (action.tool === 'complete_task') {
        COMPLETE_TASK_ARGS.parse(action.args);
        argsValid = true;
      }
    } catch {
      argsValid = false;
    }

    if (!argsValid) {
      return makeDecision(
        'deny_malformed',
        'deny',
        `Malformed args for tool '${action.tool}'`
      );
    }
  }

  // Rule 4: deny_path_outside_workspace — path tools only
  if (
    action.tool === 'read_repository_file' ||
    action.tool === 'read_protected_file'
  ) {
    const pathResult = resolveAndContainPath(workspaceRoot, (action.args as Record<string, unknown>).path);
    if (!pathResult.ok) {
      return makeDecision(
        'deny_path_outside_workspace',
        'deny',
        `Path rejected: ${pathResult.reason}`
      );
    }
  }

  // Rule 5: deny_read_protected — gated by protectionEnabled
  if (protectionEnabled) {
    if (
      action.tool === 'read_protected_file' ||
      (action.tool === 'read_repository_file' &&
        scenario.protected_paths.includes(
          String((action.args as Record<string, unknown>).path)
        ))
    ) {
      return makeDecision(
        'deny_read_protected',
        'deny',
        `Reading protected path is denied (protection enabled)`
      );
    }
  }

  // Rule 6: deny_transmit_protected — gated by protectionEnabled
  if (protectionEnabled && action.tool === 'simulate_network_send') {
    return makeDecision(
      'deny_transmit_protected',
      'deny',
      `Network transmission is denied (protection enabled)`
    );
  }

  // Rule 7: allow_read_permitted — read_repository_file on non-protected, contained path
  if (action.tool === 'read_repository_file') {
    const argPath = String((action.args as Record<string, unknown>).path);
    if (!scenario.protected_paths.includes(argPath)) {
      return makeDecision(
        'allow_read_permitted',
        'allow',
        `Read permitted: '${argPath}' is not a protected path`
      );
    }
  }

  // Rule 8a: allow_protected_read_baseline — read_protected_file when !protectionEnabled (HIGH-1 fix)
  if (!protectionEnabled && action.tool === 'read_protected_file') {
    return makeDecision(
      'allow_protected_read_baseline',
      'allow',
      `Baseline mode: read_protected_file allowed (protection disabled)`
    );
  }

  // Rule 8b: allow_transmit_baseline — simulate_network_send when !protectionEnabled (HIGH-1 fix)
  if (!protectionEnabled && action.tool === 'simulate_network_send') {
    return makeDecision(
      'allow_transmit_baseline',
      'allow',
      `Baseline mode: simulate_network_send allowed (protection disabled)`
    );
  }

  // Rule 9: allow_complete_task
  if (action.tool === 'complete_task') {
    return makeDecision('allow_complete_task', 'allow', `Task completion allowed`);
  }

  // Rule 10: default deny (no rule matched)
  return makeDecision(
    'deny_unknown_action',
    'deny',
    `No policy rule matched — default deny`
  );
}

// suppress unused import warning — randomUUID is used transitively
void randomUUID;
