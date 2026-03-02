/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  deterministic cache key builders

  - builds consistent string keys from query args (e.g. "controls:list:first=10:category=soc2")
  - same args always produce the same key — that's what "deterministic" means
  - different args produce different keys — prevents cross-talk between results
  - undefined args are omitted so "no filter" and "filter not passed" are the same key
  - reuses shared pagination/search normalization so equivalent inputs collapse to one canonical key
  - adds overview-search key builders for request-scoped grouped-search memoization
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import {
  clampFirst,
  normalizeSearchInput,
  normalizeText
} from '../services/pagination'; // reuse shared input normalization so cache identity matches live search semantics

// ---------- public types ----------

// ListArgs mirrors the args that controlsConnection + faqsConnection resolvers accept
// all fields are optional because any combination of filters is valid
export type ListArgs = {
  first?: number; // how many items per page
  after?: string; // pagination cursor — points to where the last page ended
  category?: string; // filter by category (e.g. "SOC2", "Privacy")
  search?: string; // substring search term
};

// OverviewSearchKeyArgs mirrors the grouped overview search contract
export type OverviewSearchKeyArgs = {
  search: string; // normalized overview search term
  firstPerKind?: number; // per-entity visible row cap
};

// options for shared read-cache keys  -->  auth scope is included so future admin/private reads do not collide with public reads
export type ReadKeyOptions = {
  authScope?: string; // placeholder auth scope segment (e.g. "public", "admin")
};

// ---------- public key builders (existing raw/memo-friendly keys) ----------

// public key builder for controls queries — delegates to the shared helper
export function buildControlsKey(args: ListArgs): string {
  return buildListKey('controls', args); // prefix "controls" so keys never clash with faqs
}

// public key builder for faqs queries — delegates to the shared helper
export function buildFaqsKey(args: ListArgs): string {
  return buildListKey('faqs', args); // prefix "faqs" so keys never clash with controls
}

// public key builder for grouped overview search — normalized for request-scoped memo identity
export function buildOverviewSearchKey(args: OverviewSearchKeyArgs): string {
  const normalizedArgs = normalizeOverviewSearchArgsForKey(args); // canonical grouped-search arg shape
  const parts: string[] = ['overview-search:list']; // separate prefix keeps grouped-search keys grep-friendly

  parts.push(`search=${normalizedArgs.search}`); // overview search always includes a normalized search term

  if (normalizedArgs.firstPerKind !== undefined) {
    parts.push(`firstPerKind=${normalizedArgs.firstPerKind}`); // per-kind page size changes the grouped result shape
  }

  return parts.join(':'); // readable deterministic grouped-search key
}

// ---------- public key builders (normalized read-cache keys) ----------

// public read-cache key builder for controls queries — normalizes args + adds auth scope
export function buildControlsReadCacheKey(
  args: ListArgs,
  opts: ReadKeyOptions = {}
): string {
  return buildReadCacheKey('controls', args, opts); // normalized key for cross-request shared cache
}

// public read-cache key builder for faqs queries — normalizes args + adds auth scope
export function buildFaqsReadCacheKey(
  args: ListArgs,
  opts: ReadKeyOptions = {}
): string {
  return buildReadCacheKey('faqs', args, opts); // normalized key for cross-request shared cache
}

// ---------- internal shared builders ----------

// internal helper — builds the full key string from entity name + args
// not exported because outside code should use buildControlsKey / buildFaqsKey
function buildListKey(entity: string, args: ListArgs): string {
  const parts: string[] = [`${entity}:list`]; // always starts with e.g. "controls:list"

  // only append a segment if the arg was actually provided
  // this keeps raw keys readable and preserves exact input shape for memo/debug use
  if (args.first !== undefined) parts.push(`first=${args.first}`);
  if (args.after !== undefined) parts.push(`after=${args.after}`);
  if (args.category !== undefined) parts.push(`category=${args.category}`);
  if (args.search !== undefined) parts.push(`search=${args.search}`);

  // join with ":" to produce a readable key like "controls:list:first=10:category=SOC2"
  return parts.join(':');
}

// internal helper — builds a normalized key string for shared read caching
// not exported because outside code should use buildControlsReadCacheKey / buildFaqsReadCacheKey
function buildReadCacheKey(
  entity: string,
  args: ListArgs,
  opts: ReadKeyOptions
): string {
  const normalizedArgs = normalizeListArgsForReadCache(args); // normalize equivalent inputs to the same key
  const authScope = normalizeAuthScope(opts.authScope); // placeholder auth segment defaults to public
  const parts: string[] = [`${entity}:list`, `role=${authScope}`]; // prefix supports prefix invalidation later

  // only append normalized segments that are actually present
  if (normalizedArgs.first !== undefined)
    parts.push(`first=${normalizedArgs.first}`);
  if (normalizedArgs.after !== undefined)
    parts.push(`after=${normalizedArgs.after}`);
  if (normalizedArgs.category !== undefined)
    parts.push(`category=${normalizedArgs.category}`);
  if (normalizedArgs.search !== undefined)
    parts.push(`search=${normalizedArgs.search}`);

  // join with ":" to produce a readable deterministic key for shared cache usage
  return parts.join(':');
}

// ---------- normalization helpers (shared key identity) ----------

function normalizeListArgsForReadCache(args: ListArgs): ListArgs {
  const out: ListArgs = {}; // build normalized arg bag while omitting undefined fields

  if (args.first !== undefined) out.first = clampFirst(args.first); // mirror live pagination clamp behavior

  if (args.after !== undefined) {
    const afterTrimmed = String(args.after).trim(); // trim accidental whitespace around opaque cursor
    if (afterTrimmed !== '') out.after = afterTrimmed; // omit empty cursor strings
  }

  if (args.category !== undefined) {
    const normalizedCategory = normalizeCategoryForKey(args.category); // trim + collapse spaces + lowercase
    if (normalizedCategory !== '') out.category = normalizedCategory; // omit empty category filters
  }

  if (args.search !== undefined) {
    const normalizedSearch = normalizeSearchForKey(args.search); // reuse shared search normalization before lowering for key stability
    if (normalizedSearch !== undefined) out.search = normalizedSearch; // omit empty search filters
  }

  return out; // deterministic normalized args for shared read-cache keys
}

function normalizeOverviewSearchArgsForKey(
  args: OverviewSearchKeyArgs
): Required<OverviewSearchKeyArgs> {
  const search = normalizeSearchForKey(args.search) ?? ''; // grouped-search callers should already validate, but keep the key builder defensive
  const firstPerKind = clampFirst(args.firstPerKind ?? 5); // align grouped-search key identity with live page size clamp

  return {
    search,
    firstPerKind
  }; // canonical grouped-search args for deterministic memo identity
}

function normalizeCategoryForKey(value: string): string {
  const normalized = normalizeText(String(value)); // trim + collapse internal spaces
  return normalized === '' ? '' : normalized.toLowerCase(); // case-insensitive key identity
}

function normalizeSearchForKey(value: string): string | undefined {
  const normalized = normalizeSearchInput(String(value)); // shared search normalization omits blank/whitespace-only input
  return normalized ? normalized.toLowerCase() : undefined; // case-insensitive key identity for current substring search semantics
}

function normalizeAuthScope(value: string | undefined): string {
  const normalized = String(value ?? 'public')
    .trim()
    .toLowerCase(); // default to public for current prototype reads
  return normalized === '' ? 'public' : normalized; // never emit an empty role segment
}
