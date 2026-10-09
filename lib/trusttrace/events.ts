import { randomUUID } from 'node:crypto';
import type { Event } from '@/lib/trusttrace/models';

// ============================================================
// Redaction — dual-layer (MEDIUM-2)
// ============================================================

// Layer 1: regex pattern that always catches FAKE_SECRET format
export const FAKE_SECRET_RE = /FAKE_SECRET_DO_NOT_USE_[A-Za-z0-9_\-]+/g;

/**
 * Redacts secrets from a string using two layers:
 * 1. Regex pattern matching FAKE_SECRET_DO_NOT_USE_... format
 * 2. Exact string replacement for each known secret from ctx.knownSecrets
 */
export function redactSecrets(text: string, knownSecrets: string[] = []): string {
  // Layer 1: format-matching regex — always catches pattern regardless of list population
  let t = text.replace(FAKE_SECRET_RE, '[REDACTED_FAKE_SECRET]');
  // Layer 2: exact known strings (populated from protected fixture at run start)
  for (const s of knownSecrets) {
    if (s.length > 0) {
      t = t.split(s).join('[REDACTED_FAKE_SECRET]');
    }
  }
  return t;
}

// ============================================================
// Redact all string values recursively within an object/value
// ============================================================

function redactValue(val: unknown, knownSecrets: string[]): unknown {
  if (typeof val === 'string') {
    return redactSecrets(val, knownSecrets);
  }
  if (Array.isArray(val)) {
    return val.map((item) => redactValue(item, knownSecrets));
  }
  if (val !== null && typeof val === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      result[k] = redactValue(v, knownSecrets);
    }
    return result;
  }
  return val;
}

// ============================================================
// makeEvent factory
// ============================================================

/**
 * Creates an event with stamped event_id, seq, timestamp.
 * Applies redactSecrets to all string fields in metadata.
 * Rationale is truncated to 200 chars.
 */
export function makeEvent(
  type: string,
  runId: string,
  seq: number,
  fields: Partial<Event>,
  knownSecrets: string[] = []
): Event {
  const base = {
    event_id: randomUUID(),
    run_id: runId,
    seq,
    timestamp: new Date().toISOString(),
    ...fields,
    type,
    metadata: redactValue(fields.metadata ?? {}, knownSecrets) as Record<string, unknown>,
  };

  // Truncate rationale in metadata if present
  if (
    base.metadata &&
    typeof (base.metadata as Record<string, unknown>).rationale === 'string'
  ) {
    const meta = base.metadata as Record<string, unknown>;
    meta.rationale = (meta.rationale as string).slice(0, 200);
  }

  return base as unknown as Event;
}
