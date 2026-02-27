/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  thin GraphQL resolver layer

  - keeps resolver responsibilities small and predictable
  - delegates all read-path work to services
  - validates cursors before service execution
  - maps db/service rows into GraphQL-safe node shapes
  - logs which source produced the data for debugging
  - preserves the existing GraphQL contract for the frontend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { GraphQLContext } from './context'; // shared request context injected by GraphQL Yoga
import { isValidCursor, encodeCursor, toIso } from '../services/pagination'; // shared cursor + timestamp helpers
import {
  getControlsPage,
  type DbControlRow
} from '../services/controlsService'; // controls read-path service owns db/cache/memo/pagination
import { getFaqsPage, type DbFaqRow } from '../services/faqsService'; // faqs read-path service owns db/cache/memo/pagination

// ---------- data-source logging ----------

type DataSource = 'db' | 'mock'; // service layer reports whether rows came from the real db or seed fallback

function logDataSource(args: {
  requestId: string;
  resolverName: string;
  source: DataSource;
  returnedCount: number;
}): void {
  console.log(
    `[data] requestId=${args.requestId} resolver=${args.resolverName} source=${args.source} count=${args.returnedCount}`
  ); // one structured line makes terminal scanning easier during backend verification
}

// ---------- row-to-node mappers ----------

function mapControlNode(row: DbControlRow) {
  return {
    id: row.id, // GraphQL node id
    controlKey: row.control_key, // db snake_case -> api camelCase
    title: row.title, // pass through title as-is
    description: row.description, // pass through description as-is
    category: row.category, // pass through category as-is
    sourceUrl: row.source_url, // db snake_case -> api camelCase
    updatedAt: toIso(row.updated_at) // normalize db timestamp into GraphQL-friendly iso string
  };
}

function mapFaqNode(row: DbFaqRow) {
  return {
    id: row.id, // GraphQL node id
    faqKey: row.faq_key, // db snake_case -> api camelCase
    question: row.question, // pass through question as-is
    answer: row.answer, // pass through answer as-is
    category: row.category, // pass through category as-is
    updatedAt: toIso(row.updated_at) // normalize db timestamp into GraphQL-friendly iso string
  };
}

// ---------- query resolvers ----------

export const resolvers = {
  Query: {
    hello: () => 'helloWorld from GraphQL!', // lightweight sanity field to prove schema wiring
    health: () => 'OK', // lightweight health field to prove resolver execution path

    debugContext: (_parent: unknown, _args: unknown, ctx: GraphQLContext) => ({
      requestId: ctx.requestId, // exposes request id so the team can match GraphiQL output to terminal logs
      isAdmin: ctx.auth.isAdmin // exposes placeholder auth state while auth is still a stub
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
      if (args.after && !isValidCursor(args.after)) {
        throw new Error('CURSOR_ERROR: invalid after cursor'); // fail fast so bad cursors never reach the service layer
      }

      const page = await getControlsPage(args, ctx); // service owns db reads, filtering, pagination, cache, memo, and fallback

      logDataSource({
        requestId: ctx.requestId, // attach the same request trace id used by cache/db logs
        resolverName: 'controlsConnection', // identify which resolver returned this data
        source: page.source, // tells us whether this came from db or fallback
        returnedCount: page.rows.length // shows the number of rows actually returned for this page
      });

      const edges = page.rows.map(row => ({
        cursor: encodeCursor({
          sortValue: toIso(row.updated_at), // keep cursor aligned with service/db sort order
          id: row.id // id is the tie-breaker to keep ordering stable
        }),
        node: mapControlNode(row) // convert db/service row into frontend GraphQL shape
      }));

      return {
        edges, // Relay-style edge array
        pageInfo: {
          hasNextPage: page.hasNextPage, // service already determined if a next page exists
          endCursor: page.endCursor // service already computed the last cursor for this page
        },
        totalCount: page.totalCount // total count stays on the connection for client pagination metadata
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
      if (args.after && !isValidCursor(args.after)) {
        throw new Error('CURSOR_ERROR: invalid after cursor'); // fail fast so bad cursors never reach the service layer
      }

      const page = await getFaqsPage(args, ctx); // service owns db reads, filtering, pagination, cache, memo, and fallback

      logDataSource({
        requestId: ctx.requestId, // attach the same request trace id used by cache/db logs
        resolverName: 'faqsConnection', // identify which resolver returned this data
        source: page.source, // tells us whether this came from db or fallback
        returnedCount: page.rows.length // shows the number of rows actually returned for this page
      });

      const edges = page.rows.map(row => ({
        cursor: encodeCursor({
          sortValue: toIso(row.updated_at), // keep cursor aligned with service/db sort order
          id: row.id // id is the tie-breaker to keep ordering stable
        }),
        node: mapFaqNode(row) // convert db/service row into frontend GraphQL shape
      }));

      return {
        edges, // Relay-style edge array
        pageInfo: {
          hasNextPage: page.hasNextPage, // service already determined if a next page exists
          endCursor: page.endCursor // service already computed the last cursor for this page
        },
        totalCount: page.totalCount // total count stays on the connection for client pagination metadata
      };
    }
  }
};
