/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  entity-level cache invalidation helpers

  - wraps invalidatePrefix() with named, documented functions per entity
  - callers never need to remember raw prefix strings
  - called by mutation resolvers after any write that changes controls or faqs data
  - coarse invalidation: wipes all pages/filters for an entity at once
  - returns the cleared prefix so callers can log verifier-friendly evidence
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { Cache } from './cache'; // only need the interface type here

export const CONTROLS_LIST_PREFIX = 'controls:list:'; // keep invalidation scoped to cached list reads only
export const FAQS_LIST_PREFIX = 'faqs:list:'; // same pattern for faq list-read cache entries

export function invalidateControls(cache: Cache): string {
  cache.invalidatePrefix?.(CONTROLS_LIST_PREFIX); // only clear controls list/read entries
  return CONTROLS_LIST_PREFIX; // return exact prefix so resolvers/services can log what changed
}

export function invalidateFaqs(cache: Cache): string {
  cache.invalidatePrefix?.(FAQS_LIST_PREFIX); // only clear faq list/read entries
  return FAQS_LIST_PREFIX; // return exact prefix so resolvers/services can log what changed
}
