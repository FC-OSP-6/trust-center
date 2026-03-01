/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR --> read-path EXPLAIN helper for backend perf checks

  - runs EXPLAIN ANALYZE for representative controls + faqs read queries
  - probes real categories from the current DB instead of assuming hardcoded values exist
  - proves whether index-friendly predicates are present in the query shape
  - shows that current substring search remains a seq-scan prototype choice
  - avoids shell/psql quoting issues by reusing the app's DB layer + .env loading
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { closeDbPool, query } from './index'; // reuse the app db layer so local .env loading and pool config stay consistent

// ---------- explain case model ----------

type ExplainCase = {
  name: string; // short stable label for the case being explained
  expectation: string; // what the team should look for in the EXPLAIN output
  sql: string; // explain analyze statement to execute
  params?: unknown[]; // optional parameter bag for the statement
};

// ---------- category probing helpers ----------

async function getExistingLowercaseCategory(
  tableName: 'controls' | 'faqs'
): Promise<string | null> {
  const res = await query(
    `
      select lower(category) as category
      from public.${tableName}
      where category is not null
        and btrim(category) <> ''
      group by lower(category)
      order by count(*) desc, lower(category) asc
      limit 1
    `
  ); // pick a real category from the live table so explain cases do not probe nonexistent values

  const value = res.rows?.[0]?.category; // first row is the most common normalized category if one exists
  return typeof value === 'string' && value.length > 0 ? value : null; // return null when the table has no usable categories
}

function getFallbackCategory(tableName: 'controls' | 'faqs'): string {
  if (tableName === 'controls') return 'security'; // stable fallback for local/dev cases where the table is empty
  return 'general'; // stable fallback for local/dev cases where the table is empty
}

// ---------- explain case builders ----------

function buildExplainCases(args: {
  controlsCategory: string;
  faqsCategory: string;
}): ExplainCase[] {
  return [
    {
      name: 'controls_category_count',
      expectation:
        'index-friendly predicate present for lower(category) count query; planner may still choose seq scan on tiny tables',
      sql: `
        EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
        SELECT count(*)::int AS count
        FROM public.controls
        WHERE lower(category) = $1
      `,
      params: [args.controlsCategory] // mirrors the normalized lowercase category param used by the service layer
    },
    {
      name: 'controls_category_page',
      expectation:
        'index-friendly predicate present for lower(category) page query while ORDER BY stays compatible with updated_at/id pagination',
      sql: `
        EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
        SELECT id, control_key, title, description, category, source_url, updated_at
        FROM public.controls
        WHERE lower(category) = $1
        ORDER BY updated_at DESC, id DESC
        LIMIT $2
      `,
      params: [args.controlsCategory, 3] // mirrors a small paginated page query with one-row overfetch shape
    },
    {
      name: 'faqs_category_count',
      expectation:
        'index-friendly predicate present for lower(category) count query; planner may still choose seq scan on tiny tables',
      sql: `
        EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
        SELECT count(*)::int AS count
        FROM public.faqs
        WHERE lower(category) = $1
      `,
      params: [args.faqsCategory] // mirrors the normalized lowercase category param used by the service layer
    },
    {
      name: 'faqs_category_page',
      expectation:
        'index-friendly predicate present for lower(category) page query while ORDER BY stays compatible with updated_at/id pagination',
      sql: `
        EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
        SELECT id, faq_key, question, answer, category, updated_at
        FROM public.faqs
        WHERE lower(category) = $1
        ORDER BY updated_at DESC, id DESC
        LIMIT $2
      `,
      params: [args.faqsCategory, 3] // mirrors a small paginated page query with one-row overfetch shape
    },
    {
      name: 'controls_search_page',
      expectation:
        'seq scan is acceptable for now because ILIKE substring search is still the chosen prototype behavior',
      sql: `
        EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
        SELECT id, control_key, title, description, category, source_url, updated_at
        FROM public.controls
        WHERE search_text ILIKE $1 ESCAPE '\\'
        ORDER BY updated_at DESC, id DESC
        LIMIT $2
      `,
      params: ['%audit%', 3] // mirrors current contains-search semantics instead of future full-text semantics
    },
    {
      name: 'faqs_search_page',
      expectation:
        'seq scan is acceptable for now because ILIKE substring search is still the chosen prototype behavior',
      sql: `
        EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
        SELECT id, faq_key, question, answer, category, updated_at
        FROM public.faqs
        WHERE search_text ILIKE $1 ESCAPE '\\'
        ORDER BY updated_at DESC, id DESC
        LIMIT $2
      `,
      params: ['%security%', 3] // mirrors current contains-search semantics instead of future full-text semantics
    }
  ];
}

// ---------- output helpers ----------

function printDivider(label: string): void {
  console.log(''); // visual spacing between explain cases
  console.log(`// ---------- ${label} ----------`); // team-style section marker for terminal output
}

function extractPlanLines(rows: Array<Record<string, unknown>>): string[] {
  return rows
    .map(row => row['QUERY PLAN']) // postgres returns each line under the QUERY PLAN column
    .filter((line): line is string => typeof line === 'string'); // keep only text plan lines
}

function summarizePlan(planLines: string[]): string {
  const joined = planLines.join('\n').toLowerCase(); // make matching simple and case-insensitive

  if (joined.includes('index scan')) return 'index-scan-visible'; // strongest positive signal for direct index usage
  if (joined.includes('bitmap index scan')) return 'bitmap-index-scan-visible'; // also good and index-backed
  if (joined.includes('seq scan')) return 'seq-scan-visible'; // acceptable for tiny tables or substring search cases
  return 'scan-type-not-obvious'; // fallback when postgres chooses another plan shape
}

// ---------- runner ----------

async function run(): Promise<void> {
  try {
    const liveControlsCategory =
      (await getExistingLowercaseCategory('controls')) ??
      getFallbackCategory('controls'); // prefer a real live category so category probes actually hit data when possible

    const liveFaqsCategory =
      (await getExistingLowercaseCategory('faqs')) ??
      getFallbackCategory('faqs'); // prefer a real live category so category probes actually hit data when possible

    printDivider('probe_context');
    console.log(
      `controlsCategoryProbe=${JSON.stringify(liveControlsCategory)}`
    ); // echo the actual controls category used for category explain cases
    console.log(`faqsCategoryProbe=${JSON.stringify(liveFaqsCategory)}`); // echo the actual faqs category used for category explain cases

    const explainCases = buildExplainCases({
      controlsCategory: liveControlsCategory,
      faqsCategory: liveFaqsCategory
    }); // build cases only after live probe values are known

    for (const explainCase of explainCases) {
      printDivider(explainCase.name); // separate each explain case in terminal output

      console.log(`expectation: ${explainCase.expectation}`); // remind the team what to look for before reading the plan
      console.log(`params: ${JSON.stringify(explainCase.params ?? [])}`); // echo params so the evidence can be repeated exactly

      const res = await query(explainCase.sql, explainCase.params ?? []); // execute EXPLAIN through the shared db adapter
      const planLines = extractPlanLines(
        res.rows as Array<Record<string, unknown>>
      ); // normalize the returned plan text

      for (const line of planLines) {
        console.log(line); // print raw explain output for copy/paste into PR notes
      }

      console.log(`summary: ${summarizePlan(planLines)}`); // tiny scan-shape summary for quicker review
    }
  } finally {
    await closeDbPool(); // close the pg pool so the script exits cleanly
  }
}

run().catch(error => {
  console.error('[explain] failed:', error); // structured top-level failure line for terminal scanning
  process.exitCode = 1; // non-zero exit helps CI/local checks detect failure
});
