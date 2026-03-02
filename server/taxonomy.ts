/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  shared taxonomy contract helpers

  - centralizes taxonomy manifest types + validation
  - provides canonical label normalization + lookup helpers
  - resolves section/category/subcategory from one shared manifest
  - exposes normalized search-text helpers used by seed + fallback paths
  - keeps runtime taxonomy logic out of seed-runner / fallback-loader orchestration files
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import fs from 'node:fs/promises'; // read shared taxonomy manifest json from disk

// ---------- taxonomy contract types ----------

export type TaxonomyEntityName = 'controls' | 'faqs'; // supported manifest entity buckets

export type TaxonomyCategoryEntry = {
  section: string; // broad stable backend bucket
  defaultSubcategory?: string | null; // fallback fine-grained bucket
  subcategories?: string[]; // allowed subcategories for this category
};

export type TaxonomyEntityManifest = {
  categories: Record<string, TaxonomyCategoryEntry>; // canonical category map
};

export type TaxonomyManifest = {
  version: number; // manifest version for future contract evolution
  fields: string[]; // expected taxonomy field names
  controls: TaxonomyEntityManifest; // controls taxonomy vocabulary
  faqs: TaxonomyEntityManifest; // faqs taxonomy vocabulary
};

export type ResolvedTaxonomy = {
  section: string; // canonical section resolved from the manifest
  category: string; // canonical category label preserved for compatibility
  subcategory: string | null; // canonical or default subcategory
};

// ---------- normalization helpers ----------

export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' '); // trim + collapse internal spaces into one shared normalized form
}

export function buildSearchText(parts: string[]): string {
  const normalized = parts
    .map(part => normalizeWhitespace(String(part ?? '')))
    .filter(part => part.length > 0); // drop empty normalized pieces before joining

  return normalized.join(' ').toLowerCase(); // deterministic lowercase text keeps contains-search behavior stable
}

function normalizeTaxonomyLabel(value: unknown): string | null {
  const text = normalizeWhitespace(String(value ?? '')); // collapse whitespace before optional-label checks
  return text.length > 0 ? text : null; // avoid storing empty strings as semantic taxonomy values
}

function findCanonicalLabel(
  options: string[],
  rawLabel: string
): string | null {
  const normalizedTarget = normalizeWhitespace(rawLabel).toLowerCase(); // normalize once so matching stays case-insensitive

  for (const option of options) {
    if (normalizeWhitespace(option).toLowerCase() === normalizedTarget) {
      return option; // preserve canonical manifest casing when a match is found
    }
  }

  return null; // caller decides whether a missing label is fatal
}

// ---------- taxonomy manifest validation ----------

export function assertValidTaxonomyManifest(
  manifest: TaxonomyManifest,
  sourceLabel = 'taxonomy manifest'
): void {
  const expectedFields = ['section', 'category', 'subcategory']; // 006-B contract is intentionally compact and stable
  const actualFields = Array.isArray(manifest.fields) ? manifest.fields : []; // tolerate malformed json long enough to throw a readable error below

  if (!Number.isFinite(Number(manifest.version))) {
    throw new Error(
      `TAXONOMY_ERROR: ${sourceLabel} is missing a valid numeric version.`
    );
  }

  if (
    actualFields.length !== expectedFields.length ||
    actualFields.some((field, index) => field !== expectedFields[index])
  ) {
    throw new Error(
      `TAXONOMY_ERROR: ${sourceLabel} fields must be exactly [${expectedFields.join(', ')}]. Received [${actualFields.join(', ')}].`
    );
  }

  for (const entity of ['controls', 'faqs'] as const) {
    const categories = manifest[entity]?.categories; // inspect each entity bucket independently so errors stay readable
    const categoryNames = categories ? Object.keys(categories) : [];

    if (!categories || categoryNames.length === 0) {
      throw new Error(
        `TAXONOMY_ERROR: ${sourceLabel} is missing categories for "${entity}".`
      );
    }

    for (const categoryName of categoryNames) {
      const entry = categories[categoryName];
      const section = normalizeTaxonomyLabel(entry?.section);

      if (!section) {
        throw new Error(
          `TAXONOMY_ERROR: ${sourceLabel} category "${categoryName}" in "${entity}" is missing a valid section.`
        );
      }
    }
  }
}

export async function readTaxonomyManifestFile(
  absolutePath: string,
  sourceLabel = 'taxonomy.json'
): Promise<TaxonomyManifest> {
  const raw = await fs.readFile(absolutePath, 'utf8').catch((err: unknown) => {
    throw new Error(
      `TAXONOMY_ERROR: missing ${sourceLabel} at ${absolutePath}\n${String(err)}`
    );
  }); // shared manifest loader keeps seed + fallback disk-read behavior aligned

  const manifest = JSON.parse(raw) as TaxonomyManifest; // parse once and validate below
  assertValidTaxonomyManifest(manifest, sourceLabel); // fail fast if the on-disk manifest drifted from the shared contract
  return manifest;
}

// ---------- taxonomy row resolution ----------

export function resolveTaxonomy(
  manifest: TaxonomyManifest,
  entity: TaxonomyEntityName,
  input: {
    section?: unknown;
    category?: unknown;
    subcategory?: unknown;
  }
): ResolvedTaxonomy {
  const entityManifest = manifest[entity];
  const categoryInput = normalizeTaxonomyLabel(input.category) ?? 'General';
  const categoryNames = Object.keys(entityManifest.categories);
  const canonicalCategory = findCanonicalLabel(categoryNames, categoryInput);

  if (!canonicalCategory) {
    throw new Error(
      `TAXONOMY_ERROR: unknown ${entity} category "${categoryInput}". Allowed categories: ${categoryNames.join(', ')}`
    );
  }

  const categoryEntry = entityManifest.categories[canonicalCategory];

  if (!categoryEntry) {
    throw new Error(
      `TAXONOMY_ERROR: missing ${entity} taxonomy entry for category "${canonicalCategory}".`
    );
  }

  const canonicalSection = categoryEntry.section;
  const sectionInput = normalizeTaxonomyLabel(input.section);

  if (sectionInput) {
    const matchedSection = findCanonicalLabel([canonicalSection], sectionInput);

    if (!matchedSection) {
      throw new Error(
        `TAXONOMY_ERROR: invalid ${entity} section/category combo "${sectionInput}" -> "${canonicalCategory}". Expected section: ${canonicalSection}`
      );
    }
  }

  const allowedSubcategories = Array.isArray(categoryEntry.subcategories)
    ? categoryEntry.subcategories
    : [];
  const defaultSubcategory = normalizeTaxonomyLabel(
    categoryEntry.defaultSubcategory
  );
  const subcategoryInput = normalizeTaxonomyLabel(input.subcategory);
  const nextSubcategoryInput = subcategoryInput ?? defaultSubcategory;

  if (!nextSubcategoryInput) {
    return {
      section: canonicalSection,
      category: canonicalCategory,
      subcategory: null
    };
  }

  const canonicalSubcategory = findCanonicalLabel(
    allowedSubcategories,
    nextSubcategoryInput
  );

  if (!canonicalSubcategory) {
    throw new Error(
      `TAXONOMY_ERROR: invalid ${entity} subcategory/category combo "${nextSubcategoryInput}" -> "${canonicalCategory}". Allowed subcategories: ${allowedSubcategories.join(', ')}`
    );
  }

  return {
    section: canonicalSection,
    category: canonicalCategory,
    subcategory: canonicalSubcategory
  };
}
