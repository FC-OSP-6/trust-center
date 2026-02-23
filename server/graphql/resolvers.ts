/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR --> graphql resolvers (thin orchestration)

  - validates graphql args (cursor shape)
  - delegates read logic to services (sql + pagination + fallback + request memo)
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

// ---------- data source logs ----------

type DataSource = 'db' | 'mock';

function logDataSource(args: {
  requestId: string;
  resolverName: string;
  source: DataSource;
  returnedCount: number;
}) {
  console.log(
    `[data] requestId=${args.requestId} resolver=${args.resolverName} source=${args.source} count=${args.returnedCount}`
  ); // single-line log for terminal scanning during mvp demos
}

// ---------- field mappers (db --> graphql) ----------

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

// ---------- resolver map (schema execution) ----------

export const resolvers = {
  Query: {
    hello: () => 'helloWorld from GraphQL!', // placeholder --> proves schema executes
    health: () => 'OK', // placeholder --> proves server is healthy without graphql errors

    debugContext: (_parent: unknown, _args: unknown, ctx: GraphQLContext) => ({
      requestId: ctx.requestId, // show request trace id
      isAdmin: ctx.auth.isAdmin // show admin flag
    }),

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
        throw new Error('CURSOR_ERROR: invalid after cursor'); // fail early with readable cursor error

      const page = await getControlsPage(args, ctx); // service owns db/fallback/pagination internals + request memo dedupe

      logDataSource({
        requestId: ctx.requestId,
        resolverName: 'controlsConnection',
        source: page.source,
        returnedCount: page.rows.length
      }); // terminal visibility for db vs seed fallback behavior

      const edges = page.rows.map(row => ({
        cursor: encodeCursor({ sortValue: toIso(row.updated_at), id: row.id }), // connection cursor from stable sort tuple
        node: mapControlNode(row) // db row -> graphql node
      }));

      return {
        edges, // connection edges
        pageInfo: {
          hasNextPage: page.hasNextPage, // pagination flag from service
          endCursor: page.endCursor // service-computed end cursor
        },
        totalCount: page.totalCount // post-filter total count for ui pagination metadata
      };
    },

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
        throw new Error('CURSOR_ERROR: invalid after cursor'); // fail early with readable cursor error

      const page = await getFaqsPage(args, ctx); // service owns db/fallback/pagination internals + request memo dedupe

      logDataSource({
        requestId: ctx.requestId,
        resolverName: 'faqsConnection',
        source: page.source,
        returnedCount: page.rows.length
      }); // terminal visibility for db vs seed fallback behavior

      const edges = page.rows.map(row => ({
        cursor: encodeCursor({ sortValue: toIso(row.updated_at), id: row.id }), // connection cursor from stable sort tuple
        node: mapFaqNode(row) // db row -> graphql node
      }));

      return {
        edges, // connection edges
        pageInfo: {
          hasNextPage: page.hasNextPage, // pagination flag from service
          endCursor: page.endCursor // service-computed end cursor
        },
        totalCount: page.totalCount // post-filter total count for UI pagination metadata
      };
    }
  }
};
