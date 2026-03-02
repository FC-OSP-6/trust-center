/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR --> overview search service (grouped read-path composition)

  - owns grouped overview search composition for controls + faqs
  - reuses existing entity read services instead of inventing a second search engine
  - validates + normalizes the overview search term once at the service boundary
  - dedupes duplicate overview-search calls within one graphql request
  - keeps fallback behavior aligned automatically by delegating to existing services
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { GraphQLContext } from '../graphql/context'; // request-scoped deps (db + memo + cache + auth)
import { memoizePromise } from './memo'; // request-scoped promise dedupe helper
import { assertOverviewSearchInput, clampFirst } from './pagination'; // shared search contract + page size safety
import { getControlsPage, type ControlsPage } from './controlsService'; // existing controls read path stays the single source of truth
import { getFaqsPage, type FaqsPage } from './faqsService'; // existing faqs read path stays the single source of truth

// ---------- args + return shapes ----------

export type OverviewSearchArgs = {
  search: string; // required overview search term from graphql
  firstPerKind?: number; // optional per-entity page size cap
};

export type OverviewSearchPage = {
  search: string; // normalized search term actually used by both entity reads
  controlsPage: ControlsPage; // grouped controls bucket returned by the existing controls service
  faqsPage: FaqsPage; // grouped faqs bucket returned by the existing faqs service
  totalCount: number; // sum of controls + faqs total counts
};

// ---------- memo key helpers ----------

function buildOverviewMemoKey(args: {
  search: string;
  firstPerKind: number;
}): string {
  return [
    'searchService:getOverviewSearch', // stable service prefix keeps request memo keys grep-friendly
    `search=${args.search.toLowerCase()}`, // case-insensitive search semantics should dedupe equivalent terms
    `firstPerKind=${args.firstPerKind}` // per-kind size changes the grouped result shape
  ].join(':'); // readable deterministic memo key for one graphql request
}

// ---------- main read path ----------

export async function getOverviewSearch(
  args: OverviewSearchArgs,
  ctx: GraphQLContext
): Promise<OverviewSearchPage> {
  const search = assertOverviewSearchInput(args.search); // freeze shared overview search rules once at the service boundary
  const firstPerKind = clampFirst(args.firstPerKind ?? 5); // keep grouped reads aligned with existing page-size safety rules

  const memoKey = buildOverviewMemoKey({
    search,
    firstPerKind
  }); // request-scoped memo key for duplicate overview searches inside one graphql request

  return memoizePromise(ctx.memo, ctx.requestId, memoKey, async () => {
    const [controlsPage, faqsPage] = await Promise.all([
      getControlsPage(
        {
          first: firstPerKind,
          search
        },
        ctx
      ), // controls bucket reuses the existing controls read path with shared db/cache/fallback behavior
      getFaqsPage(
        {
          first: firstPerKind,
          search
        },
        ctx
      ) // faqs bucket reuses the existing faqs read path with shared db/cache/fallback behavior
    ]);

    return {
      search, // echo the normalized search term so graphql can return what the backend actually used
      controlsPage, // grouped controls bucket stays in raw service shape until the resolver maps it
      faqsPage, // grouped faqs bucket stays in raw service shape until the resolver maps it
      totalCount: controlsPage.totalCount + faqsPage.totalCount // grouped total remains deterministic and reviewer-friendly
    };
  });
}
