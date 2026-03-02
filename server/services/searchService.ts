/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR --> overview search service (grouped read-path composition)

  - owns grouped overview search composition for controls + faqs
  - reuses existing entity read services instead of inventing a second search engine
  - validates + normalizes the overview search term once at the service boundary
  - dedupes duplicate overview-search calls within one graphql request
  - intentionally stays request-scoped only for now because underlying entity reads already own shared cross-request caching + invalidation domains
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { GraphQLContext } from '../graphql/context'; // request-scoped deps (db + memo + cache + auth)
import { buildOverviewSearchKey } from '../cache/keys'; // deterministic grouped-search key builder for request memo identity
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

// ---------- normalization helpers ----------

function normalizeOverviewArgs(args: OverviewSearchArgs): {
  search: string;
  firstPerKind: number;
} {
  const search = assertOverviewSearchInput(args.search); // freeze shared overview-search rules once
  const firstPerKind = clampFirst(args.firstPerKind ?? 5); // clamp once so grouped reads and memo identity stay aligned

  return { search, firstPerKind }; // normalized grouped-search inputs
}

// ---------- main read path ----------

export async function getOverviewSearch(
  args: OverviewSearchArgs,
  ctx: GraphQLContext
): Promise<OverviewSearchPage> {
  const normalized = normalizeOverviewArgs(args); // compute one normalized grouped-search shape for this call
  const memoKey = buildOverviewSearchKey(normalized); // deterministic request-scoped identity for duplicate overview searches

  return memoizePromise(ctx.memo, ctx.requestId, memoKey, async () => {
    const [controlsPage, faqsPage] = await Promise.all([
      getControlsPage(
        {
          first: normalized.firstPerKind,
          search: normalized.search
        },
        ctx
      ), // controls bucket reuses the existing controls read path with shared db/cache/fallback behavior
      getFaqsPage(
        {
          first: normalized.firstPerKind,
          search: normalized.search
        },
        ctx
      ) // faqs bucket reuses the existing faqs read path with shared db/cache/fallback behavior
    ]);

    return {
      search: normalized.search, // echo the normalized search term so graphql can return what the backend actually used
      controlsPage, // grouped controls bucket stays in raw service shape until the resolver maps it
      faqsPage, // grouped faqs bucket stays in raw service shape until the resolver maps it
      totalCount: controlsPage.totalCount + faqsPage.totalCount // grouped total remains deterministic and reviewer-friendly
    };
  });
}
