/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  graphql resolvers (thin orchestration)

  - validates graphql args (cursor shape)
  - delegates all read logic to services (sql + pagination + fallback)
  - maps db rows to graphql nodes + edges
  - logs which data source served each request (db vs mock)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { GraphQLContext } from './index'; // shared per-request context shape

import { isValidCursor, encodeCursor, toIso } from '../services/pagination'; // shared pagination primitives
import {
  getControlsPage,
  type DbControlRow
} from '../services/controlsService'; // controls read path
import { getFaqsPage, type DbFaqRow } from '../services/faqsService'; // faqs read path
import type { GraphQLContext } from './context'; // shared per-request context shape

import fs from 'node:fs/promises'; // read seed json files when db is unavailable
import path from 'node:path'; // resolve data folder paths
import { fileURLToPath } from 'node:url'; // resolve current file location in ESM
import { createHash } from 'node:crypto'; // stable id fallback when seed mode is active

// ----------  db row shapes  ----------

type DbControlRow = {
  id: string; // uuid primary key
  control_key: string; // natural key used by seed upserts
  title: string; // short label
  description: string; // long detail
  category: string; // grouping
  source_url: string | null; // optional url
  updated_at: string | Date; // timestamptz
};

type DbFaqRow = {
  id: string; // uuid primary key
  faq_key: string; // natural key used by seed upserts
  question: string; // user-facing question
  answer: string; // user-facing answer
  category: string; // grouping
  updated_at: string | Date; // timestamptz
};

type CursorPayload = {
  sortValue: string; // updated_at iso string
  id: string; // uuid tie-breaker
};

// ----------  constants  ----------

const MAX_PAGE_SIZE = 50; // safety cap --> avoids accidental heavy queries

// ----------  helpers (timestamps + inputs)  ----------

function toIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString(); // pg may return Date with custom parsers
  const asDate = new Date(value); // tolerate string timestamps
  if (Number.isNaN(asDate.getTime())) return String(value); // fallback for unexpected values
  return asDate.toISOString(); // canonical iso output
}

function clampFirst(first: number): number {
  if (!Number.isFinite(first)) return 10; // default page size for bad inputs
  if (first <= 0) return 10; // default for non-positive values
  return Math.min(first, MAX_PAGE_SIZE); // enforce safety max
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' '); // trim + collapse internal spaces
}

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, m => `\\${m}`); // escape wildcard chars for LIKE/ILIKE
}

// ----------  data source logs  ----------

type DataSource = 'db' | 'mock';

function logDataSource(args: {
  requestId: string;
  resolverName: string;
  source: DataSource;
  returnedCount: number;
}) {
  // single-line log for terminal scanning during mvp demos
  console.log(
    `[data] requestId=${args.requestId} resolver=${args.resolverName} source=${args.source} count=${args.returnedCount}`
  );
}

// ----------  field mappers (db --> graphql)  ----------

function mapControlNode(row: DbControlRow) {
  return {
    id: row.id, // graphql id
    controlKey: row.control_key, // snake -> camel
    title: row.title, // passthrough
    description: row.description, // passthrough
    category: row.category, // passthrough
    sourceUrl: row.source_url, // snake -> camel
    updatedAt: toIso(row.updated_at) // timestamptz -> iso string
  };
}

function mapFaqNode(row: DbFaqRow) {
  return {
    id: row.id, // graphql id
    faqKey: row.faq_key, // snake -> camel
    question: row.question, // passthrough
    answer: row.answer, // passthrough
    category: row.category, // passthrough
    updatedAt: toIso(row.updated_at) // timestamptz -> iso string
  };
}

// ----------  resolver map (schema execution)  ----------

export const resolvers = {
  Query: {
    // placeholder --> proves schema executes
    hello: () => 'helloWorld  from  GraphQL!',

    // placeholder --> proves server is healthy without graphql errors
    health: () => 'OK',

    // debug helper --> proves context is wired
    debugContext: (_parent: unknown, _args: unknown, ctx: GraphQLContext) => ({
      requestId: ctx.requestId, // show request trace id
      isAdmin: ctx.auth.isAdmin // show admin flag
    }),

    // read-only controls connection --> pagination + filters
    controlsConnection: async (
      _parent: unknown,
      args: {
        first: number;
        after?: string;
        category?: string;
        search?: string;
      },
      ctx: GraphQLContext
    ) => {
      if (args.after && !isValidCursor(args.after))
        throw new Error('CURSOR_ERROR: invalid after cursor');

      const page = await getControlsPage(args); // db-first, mock fallback when db is unavailable

      logDataSource({
        requestId: ctx.requestId,
        resolverName: 'controlsConnection',
        source: page.source,
        returnedCount: page.rows.length
      });

      const edges = page.rows.map(row => ({
        cursor: encodeCursor({ sortValue: toIso(row.updated_at), id: row.id }),
        node: mapControlNode(row)
      }));

      return {
        edges,
        pageInfo: { hasNextPage: page.hasNextPage, endCursor: page.endCursor },
        totalCount: page.totalCount
      };
    },

    // read-only faqs connection --> mirrors controls behavior
    faqsConnection: async (
      _parent: unknown,
      args: {
        first: number;
        after?: string;
        category?: string;
        search?: string;
      },
      ctx: GraphQLContext
    ) => {
      if (args.after && !isValidCursor(args.after))
        throw new Error('CURSOR_ERROR: invalid after cursor');

      const page = await getFaqsPage(args); // db-first, mock fallback when db is unavailable

      logDataSource({
        requestId: ctx.requestId,
        resolverName: 'faqsConnection',
        source: page.source,
        returnedCount: page.rows.length
      });

      const edges = page.rows.map(row => ({
        cursor: encodeCursor({ sortValue: toIso(row.updated_at), id: row.id }),
        node: mapFaqNode(row)
      }));

      return {
        edges,
        pageInfo: { hasNextPage: page.hasNextPage, endCursor: page.endCursor },
        totalCount: page.totalCount
      };
    }
  }
};
