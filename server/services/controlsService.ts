/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR --> controls service (single place for read + write logic)

  - builds sql for controlsConnection (filters + cursor boundary + deterministic order)
  - keeps pagination behavior identical to previous resolver implementation
  - supports seed json fallback when db is unavailable (mvp resilience)
  - dedupes duplicate reads within one graphql request using request-scoped memoization
  - adds shared read cache (LRU TTL) for db-backed results across requests
  - exposes admin create/update/delete methods with validation, search_text recompute, and cache invalidation
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { GraphQLContext } from '../graphql/context'; // request-scoped deps (db + memo + cache + auth)
import { buildControlsReadCacheKey } from '../cache/keys'; // normalized cache key builder (includes auth scope)
import { invalidateControls } from '../cache/invalidation'; // entity-level invalidation helper for post-write cache clearing
import { memoizePromise } from './memo'; // request-scoped promise dedupe helper
import {
  getSeedControlsRows,
  getSeedControlSearchText,
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
import { buildControlSearchText } from './searchText'; // shared backend search_text recomputation for create/update writes
import {
  type CreateControlInput,
  type UpdateControlInput,
  type NormalizedControlWrite,
  type NormalizedControlPatch,
  normalizeId,
  validateCreateControlInput,
  validateUpdateControlInput
} from './validation';

// ---------- args + row shapes ----------

export type ControlsConnectionArgs = {
  first: number; // requested page size
  after?: string; // optional cursor
  category?: string; // optional category filter
  search?: string; // optional search filter
};

export type DbControlRow = {
  id: string; // uuid primary key
  control_key: string; // natural key used by seed upserts
  title: string; // short label
  description: string; // long detail
  section: string; // broad taxonomy bucket
  category: string; // compatibility grouping field
  subcategory: string | null; // finer taxonomy bucket
  tags: string[] | null; // normalized tag list
  source_url: string | null; // optional url
  updated_at: string | Date; // timestamptz
};

export type ControlsPage = {
  rows: DbControlRow[];
  hasNextPage: boolean;
  endCursor: string | null;
  totalCount: number;
  source: 'db' | 'mock';
};

export type DeleteControlResult = {
  id: string; // deleted id returned from the db write
};

// ---------- cache config helpers ----------

const CONTROLS_READ_CACHE_TTL_SECONDS = 60; // short prototype ttl keeps repeated UI reads fast while staying reasonably fresh

function getAuthScopeForReadCache(ctx: GraphQLContext): string {
  if (ctx.auth.isAdmin) return 'admin'; // placeholder until real auth scopes land
  return 'public'; // current prototype reads behave as public
}

function getWriteActor(ctx: GraphQLContext): string {
  return ctx.auth.userEmail ?? 'local-dev'; // local-dev bypass still needs a readable actor value for audit columns
}

function buildControlsReadIdentity(
  args: ControlsConnectionArgs,
  ctx: GraphQLContext
): string {
  return buildControlsReadCacheKey(args, {
    authScope: getAuthScopeForReadCache(ctx)
  }); // compute one normalized read identity so request memo + shared cache stay aligned
}

function buildControlsWhereArgs(args: ControlsConnectionArgs): {
  category?: string;
  search?: string;
} {
  const out: { category?: string; search?: string } = {}; // omit undefined props for exactOptionalPropertyTypes

  if (args.category !== undefined) out.category = args.category; // preserve caller category only when present
  if (args.search !== undefined) out.search = args.search; // preserve caller search only when present

  return out; // exactOptionalPropertyTypes-safe filter arg bag
}

function logControlsInvalidation(args: {
  requestId: string;
  prefix: string;
}): void {
  console.log(
    `[cache] requestId=${args.requestId} invalidate scope=controls prefix=${args.prefix}`
  ); // structured invalidation log keeps post-write cache behavior reviewer-friendly
}

function mapControlsConflict(error: unknown): never {
  const pgError = error as { code?: string; constraint?: string } | undefined; // pg errors often expose code + constraint

  if (
    pgError?.code === '23505' &&
    pgError.constraint === 'controls_unique_control_key'
  ) {
    throw new Error('CONFLICT_ERROR: controlKey already exists'); // natural key conflicts should be readable in GraphiQL
  }

  throw error instanceof Error ? error : new Error(String(error)); // preserve non-conflict failures without losing the stack/message
}

function buildControlSearchPayload(input: NormalizedControlWrite): string {
  return buildControlSearchText({
    controlKey: input.controlKey,
    title: input.title,
    description: input.description,
    section: input.section,
    category: input.category,
    subcategory: input.subcategory,
    tags: input.tags,
    sourceUrl: input.sourceUrl
  }); // keep one explicit builder so create/update recompute the same way
}

function mergeControlPatch(
  existing: DbControlRow,
  patch: NormalizedControlPatch
): NormalizedControlWrite {
  return {
    controlKey: patch.controlKey ?? existing.control_key,
    title: patch.title ?? existing.title,
    description: patch.description ?? existing.description,
    section: patch.section ?? existing.section,
    category: patch.category ?? existing.category,
    subcategory:
      patch.subcategory !== undefined
        ? patch.subcategory
        : existing.subcategory,
    tags: patch.tags !== undefined ? patch.tags : (existing.tags ?? null),
    sourceUrl:
      patch.sourceUrl !== undefined ? patch.sourceUrl : existing.source_url
  }; // merge partial updates into one complete write shape before recomputing search_text
}

async function getControlByIdForWrite(
  id: string,
  ctx: GraphQLContext
): Promise<DbControlRow> {
  const res = await ctx.db.query(
    `
      select
        id,
        control_key,
        title,
        description,
        section,
        category,
        subcategory,
        tags,
        source_url,
        updated_at
      from public.controls
      where id = $1::uuid
      limit 1
    `,
    [id]
  ); // fetch current row so partial updates can merge cleanly and missing ids can fail readably

  const row = res.rows?.[0] as DbControlRow | undefined;
  if (!row) {
    throw new Error('NOT_FOUND_ERROR: control not found');
  }

  return row; // existing row is required for partial update merge semantics
}

// ---------- db read path (cacheable) ----------

async function getControlsPageFromDb(
  args: ControlsConnectionArgs,
  ctx: GraphQLContext
): Promise<ControlsPage> {
  const firstClamped = clampFirst(args.first); // enforce safe page size
  const { whereSql, params } = buildCategorySearchWhere(
    buildControlsWhereArgs(args)
  ); // build shared filter predicates
  const afterBoundary = buildAfterBoundary(args.after, params.length + 1); // build cursor boundary predicate

  const countSql = `
    select count(*)::int as count
    from public.controls
    ${whereSql}
  `; // total count for connection metadata (post-filter, pre-page)

  const countRes = await ctx.db.query(countSql, params); // count query goes through injected db adapter
  const totalCount = Number(countRes.rows?.[0]?.count ?? 0); // normalize count result defensively

  const pageSql = `
    select
      id,
      control_key,
      title,
      description,
      section,
      category,
      subcategory,
      tags,
      source_url,
      updated_at
    from public.controls
    ${whereSql}
    ${whereSql ? '' : 'where true'}
    ${afterBoundary.sql}
    order by updated_at desc, id desc
    limit $${params.length + afterBoundary.params.length + 1}
  `; // deterministic desc ordering with cursor boundary + overfetch by 1

  const limitParam = firstClamped + 1; // overfetch one row to compute hasNextPage
  const pageParams = [...params, ...afterBoundary.params, limitParam]; // preserve parameter ordering
  const pageRes = await ctx.db.query(pageSql, pageParams); // paged query through injected db adapter
  const fetched = (pageRes.rows ?? []) as DbControlRow[]; // cast row shape from query result

  const hasNextPage = fetched.length > firstClamped; // extra row means more data exists
  const rows = hasNextPage ? fetched.slice(0, firstClamped) : fetched; // trim extra row for response
  const last = rows.length ? rows[rows.length - 1] : null; // last visible row determines endCursor
  const endCursor = last
    ? encodeCursor({ sortValue: toIso(last.updated_at), id: last.id })
    : null; // null when page is empty

  return { rows, hasNextPage, endCursor, totalCount, source: 'db' }; // db-backed page result
}

async function getControlsPageDbCached(
  args: ControlsConnectionArgs,
  ctx: GraphQLContext
): Promise<ControlsPage> {
  const cacheKey = buildControlsReadIdentity(args, ctx); // normalized cross-request cache key with placeholder auth scope

  const page = await ctx.cache.getOrSet(
    cacheKey,
    CONTROLS_READ_CACHE_TTL_SECONDS,
    async () => getControlsPageFromDb(args, ctx) // only db-backed reads belong in the shared cross-request cache
  );

  return page as ControlsPage; // cache interface is generic/unknown-friendly, so cast to service return type
}

// ---------- main read path ----------

export async function getControlsPage(
  args: ControlsConnectionArgs,
  ctx: GraphQLContext
): Promise<ControlsPage> {
  const readIdentity = buildControlsReadIdentity(args, ctx); // compute once so memo identity and shared cache identity cannot drift
  const memoKey = `controlsService:getControlsPage:${readIdentity}`; // namespace request memo identity to keep traceable service ownership

  return memoizePromise(ctx.memo, memoKey, async () => {
    try {
      return await getControlsPageDbCached(args, ctx); // request memo wraps shared read cache so one request never duplicates work
    } catch (error) {
      if (!shouldUseSeedFallback(error)) throw error; // only known demo-safe failures should route into fallback mode

      const reason = error instanceof Error ? error.message : String(error); // normalize unknown errors into one loggable string

      logSeedFallback({
        requestId: ctx.requestId, // tie fallback log to the same request trace used by gql/cache/db/data logs
        resolverName: 'controlsConnection', // identify which resolver path fell back
        reason // keep the db/env failure reason visible for debugging
      });

      const seedRows = await getSeedControlsRows(); // load normalized controls seed rows from the centralized fallback module
      const filtered = filterRowsByCategorySearch(seedRows, args, {
        getCategory: row => row.category, // category source for shared in-memory filter helper
        getSearchText: getSeedControlSearchText // reuse the precomputed fallback search_text so services do not drift from seed normalization
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

export async function createControl(
  input: CreateControlInput,
  ctx: GraphQLContext
): Promise<DbControlRow> {
  const actor = getWriteActor(ctx); // write actor feeds audit columns
  const normalized = validateCreateControlInput(input); // validate and normalize before any sql runs
  const searchText = buildControlSearchPayload(normalized); // recompute search_text server-side

  try {
    const res = await ctx.db.query(
      `
        insert into public.controls (
          control_key,
          title,
          description,
          section,
          category,
          subcategory,
          tags,
          source_url,
          search_text,
          created_by,
          updated_by
        )
        values ($1, $2, $3, $4, $5, $6, $7::text[], $8, $9, $10, $10)
        returning
          id,
          control_key,
          title,
          description,
          section,
          category,
          subcategory,
          tags,
          source_url,
          updated_at
      `,
      [
        normalized.controlKey,
        normalized.title,
        normalized.description,
        normalized.section,
        normalized.category,
        normalized.subcategory,
        normalized.tags,
        normalized.sourceUrl,
        searchText,
        actor
      ]
    ); // single parameterized insert keeps db writes safe and deterministic

    const row = res.rows?.[0] as DbControlRow | undefined;
    if (!row) {
      throw new Error('WRITE_ERROR: control create returned no row');
    }

    const invalidatedPrefix = invalidateControls(ctx.cache); // clear stale controls reads only after a successful write
    logControlsInvalidation({
      requestId: ctx.requestId,
      prefix: invalidatedPrefix
    });

    return row; // mutation resolver will map the row into GraphQL shape
  } catch (error) {
    mapControlsConflict(error); // translate natural-key conflicts into readable app errors
  }
}

export async function updateControl(
  id: string,
  input: UpdateControlInput,
  ctx: GraphQLContext
): Promise<DbControlRow> {
  const normalizedId = normalizeId(id); // reject blank ids before touching the db
  const actor = getWriteActor(ctx); // write actor feeds updated_by
  const patch = validateUpdateControlInput(input); // validate partial update shape before db work
  const existing = await getControlByIdForWrite(normalizedId, ctx); // fetch current row for merge semantics and readable not-found handling
  const merged = mergeControlPatch(existing, patch); // compute the post-update row shape once
  const searchText = buildControlSearchPayload(merged); // recompute search_text from the merged post-update shape

  try {
    const res = await ctx.db.query(
      `
        update public.controls
        set
          control_key = $2,
          title = $3,
          description = $4,
          section = $5,
          category = $6,
          subcategory = $7,
          tags = $8::text[],
          source_url = $9,
          search_text = $10,
          updated_by = $11,
          updated_at = now()
        where id = $1::uuid
        returning
          id,
          control_key,
          title,
          description,
          section,
          category,
          subcategory,
          tags,
          source_url,
          updated_at
      `,
      [
        normalizedId,
        merged.controlKey,
        merged.title,
        merged.description,
        merged.section,
        merged.category,
        merged.subcategory,
        merged.tags,
        merged.sourceUrl,
        searchText,
        actor
      ]
    ); // full merged update keeps SQL simple while preserving partial-update semantics at the service boundary

    const row = res.rows?.[0] as DbControlRow | undefined;
    if (!row) {
      throw new Error('NOT_FOUND_ERROR: control not found');
    }

    const invalidatedPrefix = invalidateControls(ctx.cache); // clear stale controls reads only after a successful write
    logControlsInvalidation({
      requestId: ctx.requestId,
      prefix: invalidatedPrefix
    });

    return row; // mutation resolver will map the row into GraphQL shape
  } catch (error) {
    mapControlsConflict(error); // translate natural-key conflicts into readable app errors
  }
}

export async function deleteControl(
  id: string,
  ctx: GraphQLContext
): Promise<DeleteControlResult> {
  const normalizedId = normalizeId(id); // reject blank ids before touching the db

  const res = await ctx.db.query(
    `
      delete from public.controls
      where id = $1::uuid
      returning id
    `,
    [normalizedId]
  ); // delete returns the removed id so GraphQL can prove what was deleted

  const row = res.rows?.[0] as { id: string } | undefined;
  if (!row) {
    throw new Error('NOT_FOUND_ERROR: control not found');
  }

  const invalidatedPrefix = invalidateControls(ctx.cache); // clear stale controls reads only after a successful delete
  logControlsInvalidation({
    requestId: ctx.requestId,
    prefix: invalidatedPrefix
  });

  return { id: row.id }; // mutation resolver wraps this in DeleteResult
}
