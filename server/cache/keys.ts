/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  deterministic cache key builders

  - builds consistent string keys from query args (e.g. "controls:list:first=10:category=SOC2")
  - same args always produce the same key — that's what "deterministic" means
  - different args produce different keys — prevents cross-talk between results
  - undefined args are omitted so "no filter" and "filter not passed" are the same key
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

// ListArgs mirrors the args that controlsConnection + faqsConnection resolvers accept
// all fields are optional because any combination of filters is valid
export type ListArgs = {
  first?: number; // how many items per page
  after?: string; // pagination cursor — points to where the last page ended
  category?: string; // filter by category (e.g. "SOC2", "Privacy")
  search?: string; // full-text search term
};

// public key builder for controls queries — delegates to the shared helper
export function buildControlsKey(args: ListArgs): string {
  return buildListKey('controls', args); // prefix "controls" so keys never clash with faqs
}

// public key builder for faqs queries — delegates to the shared helper
export function buildFaqsKey(args: ListArgs): string {
  return buildListKey('faqs', args); // prefix "faqs" so keys never clash with controls
}

// internal helper — builds the full key string from entity name + args
// not exported because outside code should use buildControlsKey / buildFaqsKey
function buildListKey(entity: string, args: ListArgs): string {
  const parts: string[] = [`${entity}:list`]; // always starts with e.g. "controls:list"

  // only append a segment if the arg was actually provided
  // this ensures: no category = same key as category not passed (avoids phantom cache misses)
  if (args.first !== undefined) parts.push(`first=${args.first}`);
  if (args.after !== undefined) parts.push(`after=${args.after}`);
  if (args.category !== undefined) parts.push(`category=${args.category}`);
  if (args.search !== undefined) parts.push(`search=${args.search}`);

  // join with ":" to produce a readable key like "controls:list:first=10:category=SOC2"
  return parts.join(':');
}
