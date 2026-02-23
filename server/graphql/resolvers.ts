/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  graphql resolvers (thin orchestration)

  - validates graphql args (cursor shape)
  - delegates all read logic to services (sql + pagination + fallback)
  - maps db rows to graphql nodes + edges
  - logs which data source served each request (db vs mock)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { GraphQLContext } from './context'; // shared per-request context shape

import { isValidCursor, encodeCursor, toIso } from '../services/pagination'; // shared pagination primitives
import {
  getControlsPage,
  type DbControlRow
} from '../services/controlsService'; // controls read path
import { getFaqsPage, type DbFaqRow } from '../services/faqsService'; // faqs read path

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
