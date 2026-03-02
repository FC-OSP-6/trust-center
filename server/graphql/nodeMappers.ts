/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  shared db-row to graphql-node mappers

  - centralizes camelCase mapping for controls + faqs
  - keeps read resolvers and mutation resolvers aligned
  - prevents duplicated node-shape logic across graphql files
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { toIso } from '../services/pagination'; // shared timestamp normalization
import type { DbControlRow } from '../services/controlsService'; // controls db row contract
import type { DbFaqRow } from '../services/faqsService'; // faqs db row contract

export function mapControlNode(row: DbControlRow) {
  return {
    id: row.id, // GraphQL node id
    controlKey: row.control_key, // db snake_case -> api camelCase
    title: row.title, // pass through title as-is
    description: row.description, // pass through description as-is
    section: row.section, // expose broad taxonomy bucket
    category: row.category, // pass through category as-is
    subcategory: row.subcategory, // expose finer taxonomy bucket when present
    tags: row.tags ?? [], // GraphQL list stays non-null even when db/fallback tags are absent
    sourceUrl: row.source_url, // db snake_case -> api camelCase
    updatedAt: toIso(row.updated_at) // normalize db timestamp into GraphQL-friendly iso string
  };
}

export function mapFaqNode(row: DbFaqRow) {
  return {
    id: row.id, // GraphQL node id
    faqKey: row.faq_key, // db snake_case -> api camelCase
    question: row.question, // pass through question as-is
    answer: row.answer, // pass through answer as-is
    section: row.section, // expose broad taxonomy bucket
    category: row.category, // pass through category as-is
    subcategory: row.subcategory, // expose finer taxonomy bucket when present
    tags: row.tags ?? [], // GraphQL list stays non-null even when db/fallback tags are absent
    updatedAt: toIso(row.updated_at) // normalize db timestamp into GraphQL-friendly iso string
  };
}
