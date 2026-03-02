/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  unit tests for taxonomy contract + seed helpers

  what this file proves:
    - shared taxonomy resolution accepts known category/subcategory combos
    - section/category mismatch fails clearly
    - unknown category fails clearly
    - taxonomy defaultSubcategory behavior is deterministic
    - taxonomy-aware search_text composition preserves the richer metadata pieces

  why this matters:
    - 006-B depends on one frozen taxonomy contract
    - seed normalization is now richer than simple category-only rows
    - failures here are cheaper to catch than after db seed / graphql queries
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { describe, expect, it } from 'vitest';
import {
  assertValidTaxonomyManifest,
  buildSearchText,
  resolveTaxonomy,
  type TaxonomyManifest
} from '../../server/db/seed';

// ---------- test manifest fixture ----------

const TEST_TAXONOMY: TaxonomyManifest = {
  version: 1,
  fields: ['section', 'category', 'subcategory'],
  controls: {
    categories: {
      'Access Control': {
        section: 'Identity & Access',
        defaultSubcategory: 'General',
        subcategories: ['General', 'Authentication', 'Authorization']
      },
      'Data Security': {
        section: 'Data Protection',
        defaultSubcategory: 'General',
        subcategories: ['General', 'Encryption', 'Secrets Management']
      }
    }
  },
  faqs: {
    categories: {
      Encryption: {
        section: 'Data Protection',
        defaultSubcategory: 'General',
        subcategories: ['General', 'In Transit', 'At Rest']
      },
      Monitoring: {
        section: 'Security Operations',
        defaultSubcategory: 'General',
        subcategories: ['General', 'Logging & Alerts', 'Audit Trails']
      }
    }
  }
};

// ---------- taxonomy contract coverage ----------

describe('taxonomy contract + seed helpers', () => {
  it('resolves a known controls category and applies the default subcategory when omitted', () => {
    const resolved = resolveTaxonomy(TEST_TAXONOMY, 'controls', {
      category: 'Access Control'
    });

    expect(resolved).toEqual({
      section: 'Identity & Access',
      category: 'Access Control',
      subcategory: 'General'
    }); // category-only input should resolve to the canonical section + default subcategory
  });

  it('resolves a known faq category with case-insensitive labels while preserving canonical casing', () => {
    const resolved = resolveTaxonomy(TEST_TAXONOMY, 'faqs', {
      section: 'data protection',
      category: 'encryption',
      subcategory: 'at rest'
    });

    expect(resolved).toEqual({
      section: 'Data Protection',
      category: 'Encryption',
      subcategory: 'At Rest'
    }); // inputs may vary in casing, but the resolved contract should preserve the canonical labels
  });

  it('throws a readable error when the manifest fields drift from the frozen 006-B contract', () => {
    expect(() =>
      assertValidTaxonomyManifest(
        {
          ...TEST_TAXONOMY,
          fields: ['category', 'section']
        },
        'test manifest'
      )
    ).toThrowError(/TAXONOMY_ERROR: test manifest fields must be exactly/i); // manifest-shape drift should fail before either db seed or fallback boot can continue
  });

  it('throws a readable error for an unknown category', () => {
    expect(() =>
      resolveTaxonomy(TEST_TAXONOMY, 'controls', {
        category: 'Threat Hunting'
      })
    ).toThrowError(/TAXONOMY_ERROR: unknown controls category/i); // unknown categories should fail fast before seed hits the db
  });

  it('throws a readable error for a bad section/category combo', () => {
    expect(() =>
      resolveTaxonomy(TEST_TAXONOMY, 'faqs', {
        section: 'Security Operations',
        category: 'Encryption'
      })
    ).toThrowError(/TAXONOMY_ERROR: invalid faqs section\/category combo/i); // section/category mismatches should not silently normalize to a wrong bucket
  });

  it('throws a readable error for a bad subcategory/category combo', () => {
    expect(() =>
      resolveTaxonomy(TEST_TAXONOMY, 'controls', {
        category: 'Data Security',
        subcategory: 'Privileged Access'
      })
    ).toThrowError(
      /TAXONOMY_ERROR: invalid controls subcategory\/category combo/i
    ); // subcategory drift should fail fast instead of entering the seed corpus
  });

  it('buildSearchText preserves taxonomy metadata pieces in deterministic lowercase form', () => {
    const searchText = buildSearchText([
      'MFA enforcement is documented',
      'Identity & Access',
      'Access Control',
      'Authentication',
      'Evidence shows quarterly review',
      'mfa',
      'identity',
      'review'
    ]);

    expect(searchText).toBe(
      'mfa enforcement is documented identity & access access control authentication evidence shows quarterly review mfa identity review'
    ); // taxonomy-aware search text should include section/category/subcategory context in one normalized lowercase string
    expect(searchText).toContain('identity & access'); // section improves future retrieval context
    expect(searchText).toContain('access control'); // category stays part of the compatibility/search story
    expect(searchText).toContain('authentication'); // subcategory should also be searchable
  });
});
