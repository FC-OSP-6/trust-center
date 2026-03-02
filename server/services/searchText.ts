/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR --> shared search_text builders for backend writes

  - recomputes search_text server-side on create/update
  - keeps write-path search text logic out of seed.ts and out of resolvers
  - aligns controls/faqs writes with the existing substring-search contract
  - collapses whitespace and omits blank fragments for deterministic output
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { normalizeText } from './pagination'; // reuse shared text normalization for deterministic search_text composition

type SearchPart = string | null | undefined;

function normalizeSearchPart(value: SearchPart): string | null {
  if (typeof value !== 'string') return null; // non-strings do not participate in search_text
  const normalized = normalizeText(value); // trim + collapse internal whitespace
  return normalized === '' ? null : normalized; // blank strings should not pollute search_text
}

function normalizeSearchParts(parts: SearchPart[]): string[] {
  return parts
    .map(normalizeSearchPart)
    .filter((part): part is string => part !== null); // keep only meaningful normalized fragments
}

function normalizeTagParts(tags: string[] | null | undefined): string[] {
  if (!Array.isArray(tags)) return []; // absent tags contribute nothing
  return normalizeSearchParts(tags); // normalize each tag using the same text rules
}

export function buildControlSearchText(input: {
  controlKey: string;
  title: string;
  description: string;
  section: string;
  category: string;
  subcategory: string | null;
  tags: string[] | null;
  sourceUrl: string | null;
}): string {
  return [
    ...normalizeSearchParts([
      input.controlKey,
      input.title,
      input.description,
      input.section,
      input.category,
      input.subcategory,
      input.sourceUrl
    ]),
    ...normalizeTagParts(input.tags)
  ].join(' '); // current prototype search semantics are substring-based, so one flat normalized string is sufficient
}

export function buildFaqSearchText(input: {
  faqKey: string;
  question: string;
  answer: string;
  section: string;
  category: string;
  subcategory: string | null;
  tags: string[] | null;
}): string {
  return [
    ...normalizeSearchParts([
      input.faqKey,
      input.question,
      input.answer,
      input.section,
      input.category,
      input.subcategory
    ]),
    ...normalizeTagParts(input.tags)
  ].join(' '); // current prototype search semantics are substring-based, so one flat normalized string is sufficient
}
