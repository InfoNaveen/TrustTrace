import { createHash } from 'node:crypto';
import type { ProvenanceLabel } from '@/lib/trusttrace/models';

// ============================================================
// sha256 helper
// ============================================================

export function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

// ============================================================
// Per-run provenance registry (factory, NOT a module singleton)
// ============================================================

export interface ProvenanceRegistry {
  registerSource(label: ProvenanceLabel): void;
  getSource(id: string): ProvenanceLabel | undefined;
  listSources(): ProvenanceLabel[];
  validateSourceIds(ids: string[]): { valid: string[]; invalid: string[] };
}

export function createProvenanceRegistry(): ProvenanceRegistry {
  const registry = new Map<string, ProvenanceLabel>();

  return {
    registerSource(label: ProvenanceLabel): void {
      registry.set(label.source_id, label);
    },

    getSource(id: string): ProvenanceLabel | undefined {
      return registry.get(id);
    },

    listSources(): ProvenanceLabel[] {
      return Array.from(registry.values());
    },

    validateSourceIds(ids: string[]): { valid: string[]; invalid: string[] } {
      const valid: string[] = [];
      const invalid: string[] = [];
      for (const id of ids) {
        if (registry.has(id)) {
          valid.push(id);
        } else {
          invalid.push(id);
        }
      }
      return { valid, invalid };
    },
  };
}
