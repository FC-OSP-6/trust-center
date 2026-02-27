/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  deterministic cache key builders

  - builds consistent string keys from query args (e.g. "controls:list:first=10:category=SOC2")
  - same args always produce the same key — that's what "deterministic" means
  - different args produce different keys — prevents cross-talk between results
  - undefined args are omitted so "no filter" and "filter not passed" are the same key
  - adds normalized read-cache keys (clamped first + normalized text + auth scope)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

// ---------- public types ----------

// ListArgs mirrors the args that controlsConnection + faqsConnection resolvers accept
// all fields are optional because any combination of filters is valid
export type ListArgs = {
  first?: number; // how many items per page
  after?: string; // pagination cursor — points to where the last page ended
  category?: string; // filter by category (e.g. "SOC2", "Privacy")
  search?: string; // full-text search term
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

// ---------- normalization helpers (read-cache only) ----------

const READ_KEY_MAX_PAGE_SIZE = 50; // keep aligned with pagination clamp to avoid equivalent-input cache misses

function normalizeListArgsForReadCache(args: ListArgs): ListArgs {
  const out: ListArgs = {}; // build normalized arg bag while omitting undefined fields

  if (args.first !== undefined) out.first = clampFirstForReadKey(args.first); // mirror pagination clamp behavior

  if (args.after !== undefined) {
    const afterTrimmed = String(args.after).trim(); // trim accidental whitespace around opaque cursor
    if (afterTrimmed !== '') out.after = afterTrimmed; // omit empty cursor strings
  }

  if (args.category !== undefined) {
    const normalizedCategory = normalizeTextForReadKey(args.category); // trim + collapse spaces + lowercase
    if (normalizedCategory !== '') out.category = normalizedCategory; // omit empty category filters
  }

  if (args.search !== undefined) {
    const normalizedSearch = normalizeTextForReadKey(args.search); // trim + collapse spaces + lowercase
    if (normalizedSearch !== '') out.search = normalizedSearch; // omit empty search filters
  }

  return out; // deterministic normalized args for shared read-cache keys
}

function clampFirstForReadKey(first: number): number {
  if (!Number.isFinite(first)) return 10; // mirror pagination default for invalid values
  if (first <= 0) return 10; // mirror pagination default for non-positive values
  return Math.min(first, READ_KEY_MAX_PAGE_SIZE); // mirror pagination max clamp
}

function normalizeTextForReadKey(value: string): string {
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase(); // canonical text form for stable key output
}

function normalizeAuthScope(value: string | undefined): string {
  const normalized = String(value ?? 'public')
    .trim()
    .toLowerCase(); // default to public for current prototype reads
  return normalized === '' ? 'public' : normalized; // never emit an empty role segment
}
