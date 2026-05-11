import type { GraphQLContext } from '../graphql/context';
import { getOverviewSearch } from '../services/searchService';
import type { AiCitation } from './types';

// SEARCH_MAX_LENGTH in pagination.ts is 80 — cap before passing to getOverviewSearch
const KB_SEARCH_MAX = 80;

export type KbSource = AiCitation & {
  content: string;
};

export type KbRetrievalResult = {
  sources: KbSource[];
  contextText: string;
};

export function normalizeQuestion(raw: string): string {
  const trimmed = raw.trim();
  const collapsed = trimmed.replace(/\s+/g, ' ');
  if (collapsed.length < 3) {
    throw new Error('VALIDATION_ERROR: question must be at least 3 characters');
  }
  return collapsed;
}

function buildContextText(sources: KbSource[]): string {
  return sources
    .map((s, i) => {
      const kindLabel = s.kind === 'control' ? 'Control' : 'FAQ';
      return `[${i + 1}] [id:${s.id}] [kind:${s.kind}] [category:${s.category ?? 'N/A'}]\n${kindLabel}: ${s.label}\n${s.content}`;
    })
    .join('\n\n');
}

export async function retrieveContext(
  normalizedQuestion: string,
  ctx: GraphQLContext
): Promise<KbRetrievalResult> {
  // Reuse existing grouped overview search path (getOverviewSearch) per architecture rules.
  // It composes getControlsPage + getFaqsPage with shared cache/memo/fallback behavior.
  // Cap search term at KB_SEARCH_MAX to satisfy assertOverviewSearchInput's SEARCH_MAX_LENGTH.
  const searchTerm = normalizedQuestion.slice(0, KB_SEARCH_MAX);

  const overview = await getOverviewSearch(
    { search: searchTerm, firstPerKind: 3 },
    ctx
  );

  const controlSources: KbSource[] = overview.controlsPage.rows.map(row => ({
    id: row.id,
    label: row.title,
    kind: 'control' as const,
    category: row.category,
    content: row.description
  }));

  const faqSources: KbSource[] = overview.faqsPage.rows.map(row => ({
    id: row.id,
    label: row.question,
    kind: 'faq' as const,
    category: row.category,
    content: row.answer
  }));

  const sources = [...controlSources, ...faqSources].slice(0, 6);

  return {
    sources,
    contextText: buildContextText(sources)
  };
}
