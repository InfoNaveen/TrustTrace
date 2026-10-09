import { describe, it, expect, beforeEach } from 'vitest';
import { resetStoreForTesting } from '@/lib/trusttrace/store';
import { createProvenanceRegistry } from '@/lib/trusttrace/provenance';

beforeEach(() => {
  resetStoreForTesting();
});

// Test 6: Known source_ids preserved; unknown marked invalid
describe('Provenance Test 6: validateSourceIds', () => {
  it('preserves known source_ids and marks unknown ones invalid', () => {
    const registry = createProvenanceRegistry();

    registry.registerSource({
      source_id: 'src_readme',
      source_type: 'fixture',
      origin: 'README.md',
      trust: 'untrusted',
      timestamp: new Date().toISOString(),
      metadata: {},
    });

    const result = registry.validateSourceIds(['src_readme', 'unknown_src', 'src_readme']);

    expect(result.valid).toContain('src_readme');
    expect(result.invalid).toContain('unknown_src');
    // 'src_readme' appears twice in input but is valid; unknown_src is invalid
    expect(result.valid).not.toContain('unknown_src');
    expect(result.invalid).not.toContain('src_readme');
  });

  it('returns all invalid when registry is empty', () => {
    const registry = createProvenanceRegistry();
    const result = registry.validateSourceIds(['foo', 'bar']);
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(2);
  });

  it('returns all valid when all ids are registered', () => {
    const registry = createProvenanceRegistry();
    registry.registerSource({
      source_id: 'src_a',
      source_type: 'fixture',
      origin: 'a.md',
      trust: 'untrusted',
      timestamp: new Date().toISOString(),
      metadata: {},
    });
    registry.registerSource({
      source_id: 'src_b',
      source_type: 'fixture',
      origin: 'b.md',
      trust: 'untrusted',
      timestamp: new Date().toISOString(),
      metadata: {},
    });

    const result = registry.validateSourceIds(['src_a', 'src_b']);
    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(0);
  });
});
