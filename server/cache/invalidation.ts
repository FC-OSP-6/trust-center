/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  entity-level cache invalidation helpers

  - wraps invalidatePrefix() with named, documented functions per entity
  - callers never need to remember raw prefix strings
  - called by mutation resolvers after any write that changes controls or faqs data
  - coarse invalidation: wipes all pages/filters for an entity at once
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { Cache } from './cache'; // only need the interface type here

// invalidate every cached controls list result
// call this after any admin write that changes controls data (upsert, delete)
// wipes keys like: controls:list:first=10, controls:list:category=SOC2, etc.
export function invalidateControls(cache: Cache): void {
  cache.invalidatePrefix?.('controls:'); // ?. = safe call — skips if adapter doesn't implement it
}

// invalidate every cached faqs list result
// call this after any admin write that changes faqs data (upsert, delete)
// wipes keys like: faqs:list:first=10, faqs:list:search=audit, etc.
export function invalidateFaqs(cache: Cache): void {
  cache.invalidatePrefix?.('faqs:'); // same pattern — one call clears all faq list variants
}
