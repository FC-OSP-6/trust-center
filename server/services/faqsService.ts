/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR --> faqs service (single place for read + write logic)

  - builds sql for faqsConnection (filters + cursor boundary + deterministic order)
  - keeps pagination behavior identical to previous resolver implementation
  - supports seed json fallback when db is unavailable (mvp resilience)
  - dedupes duplicate reads within one graphql request using request-scoped memoization
  - adds shared read cache (LRU TTL) for db-backed results across requests
  - exposes admin create/update/delete methods with validation, search_text recompute, and cache invalidation
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { GraphQLContext } from '../graphql/context'; // request-scoped deps (db + memo + cache + auth)
import { buildFaqsReadCacheKey } from '../cache/keys'; // normalized cache key builder (includes auth scope)
import { invalidateFaqs } from '../cache/invalidation'; // entity-level invalidation helper for post-write cache clearing
import { memoizePromise } from './memo'; // request-scoped promise dedupe helper
import {
  getSeedFaqsRows,
  getSeedFaqSearchText,
  logSeedFallback,
  shouldUseSeedFallback
} from './seedFallback'; // centralized fallback decision + seed row loading
import {
  buildAfterBoundary,
  buildCategorySearchWhere,
  filterRowsByCategorySearch,
  pageFromRows,
  toIso,
  encodeCursor,
  clampFirst
} from './pagination';
import { buildFaqSearchText } from './searchText'; // shared backend search_text recomputation for create/update writes
import {
  type CreateFaqInput,
  type UpdateFaqInput,
  type NormalizedFaqWrite,
  type NormalizedFaqPatch,
  normalizeId,
  validateCreateFaqInput,
  validateUpdateFaqInput
} from './validation';

// ---------- args + row shapes ----------

export type FaqsConnectionArgs = {
  first: number; // requested page size
  after?: string; // optional cursor
  category?: string; // optional category filter
  search?: string; // optional search filter
};

export type DbFaqRow = {
  id: string; // uuid primary key
  faq_key: string; // natural key used by seed upserts
  question: string; // user-facing question
  answer: string; // user-facing answer
  section: string; // broad taxonomy bucket
  category: string; // compatibility grouping field
  subcategory: string | null; // finer taxonomy bucket
  tags: string[] | null; // normalized tag list
  updated_at: string | Date; // timestamptz
};

export type FaqsPage = {
  rows: DbFaqRow[];
  hasNextPage: boolean;
  endCursor: string | null;
  totalCount: number;
  source: 'db' | 'mock';
};

export type DeleteFaqResult = {
  id: string; // deleted id returned from the db write
};

// ---------- cache config helpers ----------

const FAQS_READ_CACHE_TTL_SECONDS = 60; // short prototype ttl keeps repeated UI reads fast while staying reasonably fresh

function getAuthScopeForReadCache(ctx: GraphQLContext): string {
  if (ctx.auth.isAdmin) return 'admin'; // placeholder until real auth scopes land
  return 'public'; // current prototype reads behave as public
}

function getWriteActor(ctx: GraphQLContext): string {
  return ctx.auth.userEmail ?? 'local-dev'; // local-dev bypass still needs a readable actor value for audit columns
}

function buildFaqsReadIdentity(
  args: FaqsConnectionArgs,
  ctx: GraphQLContext
): string {
  return buildFaqsReadCacheKey(args, {
    authScope: getAuthScopeForReadCache(ctx)
  }); // compute one normalized read identity so request memo + shared cache stay aligned
}

function buildFaqsWhereArgs(args: FaqsConnectionArgs): {
  category?: string;
  search?: string;
} {
  const out: { category?: string; search?: string } = {}; // omit undefined props for exactOptionalPropertyTypes

  if (args.category !== undefined) out.category = args.category; // preserve caller category only when present
  if (args.search !== undefined) out.search = args.search; // preserve caller search only when present

  return out; // exactOptionalPropertyTypes-safe filter arg bag
}

function logFaqsInvalidation(args: {
  requestId: string;
  prefix: string;
}): void {
  console.log(
    `[cache] requestId=${args.requestId} invalidate scope=faqs prefix=${args.prefix}`
  ); // structured invalidation log keeps post-write cache behavior reviewer-friendly
}

function mapFaqsConflict(error: unknown): never {
  const pgError = error as { code?: string; constraint?: string } | undefined; // pg errors often expose code + constraint

  if (
    pgError?.code === '23505' &&
    pgError.constraint === 'faqs_unique_faq_key'
  ) {
    throw new Error('CONFLICT_ERROR: faqKey already exists'); // natural key conflicts should be readable in GraphiQL
  }

  throw error instanceof Error ? error : new Error(String(error)); // preserve non-conflict failures without losing the stack/message
}

function buildFaqSearchPayload(input: NormalizedFaqWrite): string {
  return buildFaqSearchText({
    faqKey: input.faqKey,
    question: input.question,
    answer: input.answer,
    section: input.section,
    category: input.category,
    subcategory: input.subcategory,
    tags: input.tags
  }); // keep one explicit builder so create/update recompute the same way
}

function mergeFaqPatch(
  existing: DbFaqRow,
  patch: NormalizedFaqPatch
): NormalizedFaqWrite {
  return {
    faqKey: patch.faqKey ?? existing.faq_key,
    question: patch.question ?? existing.question,
    answer: patch.answer ?? existing.answer,
    section: patch.section ?? existing.section,
    category: patch.category ?? existing.category,
    subcategory:
      patch.subcategory !== undefined
        ? patch.subcategory
        : existing.subcategory,
    tags: patch.tags !== undefined ? patch.tags : (existing.tags ?? null)
  }; // merge partial updates into one complete write shape before recomputing search_text
}

async function getFaqByIdForWrite(
  id: string,
  ctx: GraphQLContext
): Promise<DbFaqRow> {
  const res = await ctx.db.query(
    `
      select
        id,
        faq_key,
        question,
        answer,
        section,
        category,
        subcategory,
        tags,
        updated_at
      from public.faqs
      where id = $1::uuid
      limit 1
    `,
    [id]
  ); // fetch current row so partial updates can merge cleanly and missing ids can fail readably

  const row = res.rows?.[0] as DbFaqRow | undefined;
  if (!row) {
    throw new Error('NOT_FOUND_ERROR: faq not found');
  }

  return row; // existing row is required for partial update merge semantics
}

// ---------- db read path (cacheable) ----------

async function getFaqsPageFromDb(
  args: FaqsConnectionArgs,
  ctx: GraphQLContext
): Promise<FaqsPage> {
  const firstClamped = clampFirst(args.first); // enforce safe page size
  const { whereSql, params } = buildCategorySearchWhere(
    buildFaqsWhereArgs(args)
  ); // build shared filter predicates
  const afterBoundary = buildAfterBoundary(args.after, params.length + 1); // build cursor boundary predicate

  const countSql = `
    select count(*)::int as count
    from public.faqs
    ${whereSql}
  `; // total count for connection metadata (post-filter, pre-page)

  const countRes = await ctx.db.query(countSql, params); // count query goes through injected db adapter
  const totalCount = Number(countRes.rows?.[0]?.count ?? 0); // normalize count result defensively

  const pageSql = `
    select
      id,
      faq_key,
      question,
      answer,
      section,
      category,
      subcategory,
      tags,
      updated_at
    from public.faqs
    ${whereSql}
    ${whereSql ? '' : 'where true'}
    ${afterBoundary.sql}
    order by updated_at desc, id desc
    limit $${params.length + afterBoundary.params.length + 1}
  `; // deterministic desc ordering with cursor boundary + overfetch by 1

  const limitParam = firstClamped + 1; // overfetch one row to compute hasNextPage
  const pageParams = [...params, ...afterBoundary.params, limitParam]; // preserve parameter ordering
  const pageRes = await ctx.db.query(pageSql, pageParams); // paged query through injected db adapter
  const fetched = (pageRes.rows ?? []) as DbFaqRow[]; // cast row shape from query result

  const hasNextPage = fetched.length > firstClamped; // extra row means more data exists
  const rows = hasNextPage ? fetched.slice(0, firstClamped) : fetched; // trim extra row for response
  const last = rows.length ? rows[rows.length - 1] : null; // last visible row determines endCursor
  const endCursor = last
    ? encodeCursor({ sortValue: toIso(last.updated_at), id: last.id })
    : null; // null when page is empty

  return { rows, hasNextPage, endCursor, totalCount, source: 'db' }; // db-backed page result
}

async function getFaqsPageDbCached(
  args: FaqsConnectionArgs,
  ctx: GraphQLContext
): Promise<FaqsPage> {
  const cacheKey = buildFaqsReadIdentity(args, ctx); // normalized cross-request cache key with placeholder auth scope

  const page = await ctx.cache.getOrSet(
    cacheKey,
    FAQS_READ_CACHE_TTL_SECONDS,
    async () => getFaqsPageFromDb(args, ctx) // only db-backed reads belong in the shared cross-request cache
  );

  return page as FaqsPage; // cache interface is generic/unknown-friendly, so cast to service return type
}

// ---------- main read path ----------

export async function getFaqsPage(
  args: FaqsConnectionArgs,
  ctx: GraphQLContext
): Promise<FaqsPage> {
  const readIdentity = buildFaqsReadIdentity(args, ctx); // compute once so memo identity and shared cache identity cannot drift
  const memoKey = `faqsService:getFaqsPage:${readIdentity}`; // namespace request memo identity to keep traceable service ownership

  return memoizePromise(ctx.memo, ctx.requestId, memoKey, async () => {
    try {
      return await getFaqsPageDbCached(args, ctx); // request memo wraps shared read cache so one request never duplicates work
    } catch (error) {
      if (!shouldUseSeedFallback(error)) throw error; // only known demo-safe failures should route into fallback mode

      const reason = error instanceof Error ? error.message : String(error); // normalize unknown errors into one loggable string

      logSeedFallback({
        requestId: ctx.requestId, // tie fallback log to the same request trace used by gql/cache/db/data logs
        resolverName: 'faqsConnection', // identify which resolver path fell back
        reason // keep the db/env failure reason visible for debugging
      });

      const seedRows = await getSeedFaqsRows(); // load normalized faq seed rows from the centralized fallback module
      const filtered = filterRowsByCategorySearch(seedRows, args, {
        getCategory: row => row.category, // category source for shared in-memory filter helper
        getSearchText: getSeedFaqSearchText // reuse the precomputed fallback search_text so services do not drift from seed normalization
      });

      const pageArgs = {
        first: args.first,
        ...(args.after !== undefined ? { after: args.after } : {})
      }; // omit undefined props for exactOptionalPropertyTypes

      const page = pageFromRows(filtered, pageArgs); // paginate the filtered seed rows using the same in-memory helper as before
      return { ...page, source: 'mock' }; // preserve resolver contract while clearly signaling fallback mode
    }
  });
}

// ---------- write path ----------

export async function createFaq(
  input: CreateFaqInput,
  ctx: GraphQLContext
): Promise<DbFaqRow> {
  const actor = getWriteActor(ctx); // write actor feeds audit columns
  const normalized = validateCreateFaqInput(input); // validate and normalize before any sql runs
  const searchText = buildFaqSearchPayload(normalized); // recompute search_text server-side

  try {
    const res = await ctx.db.query(
      `
        insert into public.faqs (
          faq_key,
          question,
          answer,
          section,
          category,
          subcategory,
          tags,
          search_text,
          created_by,
          updated_by
        )
        values ($1, $2, $3, $4, $5, $6, $7::text[], $8, $9, $9)
        returning
          id,
          faq_key,
          question,
          answer,
          section,
          category,
          subcategory,
          tags,
          updated_at
      `,
      [
        normalized.faqKey,
        normalized.question,
        normalized.answer,
        normalized.section,
        normalized.category,
        normalized.subcategory,
        normalized.tags,
        searchText,
        actor
      ]
    ); // single parameterized insert keeps db writes safe and deterministic

    const row = res.rows?.[0] as DbFaqRow | undefined;
    if (!row) {
      throw new Error('WRITE_ERROR: faq create returned no row');
    }

    const invalidatedPrefix = invalidateFaqs(ctx.cache); // clear stale faq reads only after a successful write
    logFaqsInvalidation({
      requestId: ctx.requestId,
      prefix: invalidatedPrefix
    });

    return row; // mutation resolver will map the row into GraphQL shape
  } catch (error) {
    mapFaqsConflict(error); // translate natural-key conflicts into readable app errors
  }
}

export async function updateFaq(
  id: string,
  input: UpdateFaqInput,
  ctx: GraphQLContext
): Promise<DbFaqRow> {
  const normalizedId = normalizeId(id); // reject blank ids before touching the db
  const actor = getWriteActor(ctx); // write actor feeds updated_by
  const patch = validateUpdateFaqInput(input); // validate partial update shape before db work
  const existing = await getFaqByIdForWrite(normalizedId, ctx); // fetch current row for merge semantics and readable not-found handling
  const merged = mergeFaqPatch(existing, patch); // compute the post-update row shape once
  const searchText = buildFaqSearchPayload(merged); // recompute search_text from the merged post-update shape

  try {
    const res = await ctx.db.query(
      `
        update public.faqs
        set
          faq_key = $2,
          question = $3,
          answer = $4,
          section = $5,
          category = $6,
          subcategory = $7,
          tags = $8::text[],
          search_text = $9,
          updated_by = $10,
          updated_at = now()
        where id = $1::uuid
        returning
          id,
          faq_key,
          question,
          answer,
          section,
          category,
          subcategory,
          tags,
          updated_at
      `,
      [
        normalizedId,
        merged.faqKey,
        merged.question,
        merged.answer,
        merged.section,
        merged.category,
        merged.subcategory,
        merged.tags,
        searchText,
        actor
      ]
    ); // full merged update keeps SQL simple while preserving partial-update semantics at the service boundary

    const row = res.rows?.[0] as DbFaqRow | undefined;
    if (!row) {
      throw new Error('NOT_FOUND_ERROR: faq not found');
    }

    const invalidatedPrefix = invalidateFaqs(ctx.cache); // clear stale faq reads only after a successful write
    logFaqsInvalidation({
      requestId: ctx.requestId,
      prefix: invalidatedPrefix
    });

    return row; // mutation resolver will map the row into GraphQL shape
  } catch (error) {
    mapFaqsConflict(error); // translate natural-key conflicts into readable app errors
  }
}

export async function deleteFaq(
  id: string,
  ctx: GraphQLContext
): Promise<DeleteFaqResult> {
  const normalizedId = normalizeId(id); // reject blank ids before touching the db

  const res = await ctx.db.query(
    `
      delete from public.faqs
      where id = $1::uuid
      returning id
    `,
    [normalizedId]
  ); // delete returns the removed id so GraphQL can prove what was deleted

  const row = res.rows?.[0] as { id: string } | undefined;
  if (!row) {
    throw new Error('NOT_FOUND_ERROR: faq not found');
  }

  const invalidatedPrefix = invalidateFaqs(ctx.cache); // clear stale faq reads only after a successful delete
  logFaqsInvalidation({
    requestId: ctx.requestId,
    prefix: invalidatedPrefix
  });

  return { id: row.id }; // mutation resolver wraps this in DeleteResult
}
