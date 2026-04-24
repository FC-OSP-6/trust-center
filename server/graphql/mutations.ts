/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  admin mutation resolvers

  - keeps mutation resolvers thin and service-first
  - preserves admin/local-dev auth gating in one place
  - exposes safe cache invalidation hooks for pre-write verification
  - adds controls/faqs CRUD mutations that delegate to service-layer writes
  - returns mapped node payloads and readable delete results for GraphiQL verification
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { GraphQLContext } from './context'; // shared GraphQL context contract
import { invalidateControls, invalidateFaqs } from '../cache/invalidation'; // domain-level invalidation helpers
import {
  createControl,
  updateControl,
  deleteControl
} from '../services/controlsService'; // controls write methods live in the service layer
import { createFaq, updateFaq, deleteFaq } from '../services/faqsService'; // faq write methods live in the service layer
import {
  type CreateControlInput,
  type UpdateControlInput,
  type CreateFaqInput,
  type UpdateFaqInput
} from '../services/validation'; // shared write input contracts align resolver/service boundaries
import { mapControlNode, mapFaqNode } from './nodeMappers'; // shared db-row -> graphql-node mappers

// ---------- local mutation context ----------

type MutationContext = Pick<
  GraphQLContext,
  'cache' | 'requestId' | 'auth' | 'db'
>; // only the fields this file actually needs

type InvalidationScope = 'controls' | 'faqs'; // supported invalidation domains

type InvalidationResult = {
  ok: boolean; // success flag for GraphQL clients and GraphiQL smoke tests
  scope: InvalidationScope; // which domain was invalidated
  invalidatedPrefix: string; // exact prefix that was cleared
  requestId: string; // request trace id for terminal correlation
};

type DeleteResult = {
  ok: boolean; // success flag for GraphQL clients and GraphiQL smoke tests
  id: string; // deleted record id
  requestId: string; // request trace id for terminal correlation
};

// ---------- helpers ----------

export function assertAdminOrLocalDev(ctx: MutationContext): void {
  const isLocalDev = process.env.NODE_ENV !== 'production'; // local dev still allows GraphiQL mutation verification without real auth plumbing

  if (!ctx.auth.isAdmin && !isLocalDev) {
    throw new Error('FORBIDDEN: admin only'); // production requires request-derived admin auth
  }
}

function logInvalidation(args: {
  requestId: string;
  scope: InvalidationScope;
  prefix: string;
}): void {
  console.log(
    `[cache] requestId=${args.requestId} invalidate scope=${args.scope} prefix=${args.prefix}`
  ); // structured invalidation log keeps terminal traces consistent with cache/db logs
}

function buildInvalidationResult(args: {
  requestId: string;
  scope: InvalidationScope;
  invalidatedPrefix: string;
}): InvalidationResult {
  return {
    ok: true, // mutation completed successfully
    scope: args.scope, // domain that was invalidated
    invalidatedPrefix: args.invalidatedPrefix, // exact prefix that was cleared
    requestId: args.requestId // trace id for GraphiQL-to-terminal matching
  };
}

function buildDeleteResult(args: {
  requestId: string;
  id: string;
}): DeleteResult {
  return {
    ok: true, // delete completed successfully
    id: args.id, // deleted row id
    requestId: args.requestId // trace id for GraphiQL-to-terminal matching
  };
}

// ---------- mutation resolvers ----------

export const mutationResolvers = {
  Mutation: {
    adminInvalidateControlsReads: async (
      _parent: unknown,
      _args: unknown,
      ctx: MutationContext
    ): Promise<InvalidationResult> => {
      assertAdminOrLocalDev(ctx); // allow local verification now while keeping production restricted

      const invalidatedPrefix = invalidateControls(ctx.cache); // clear all cached controls list reads

      logInvalidation({
        requestId: ctx.requestId, // tie invalidation log to this GraphQL request
        scope: 'controls', // domain being invalidated
        prefix: invalidatedPrefix // exact prefix used by cache invalidation
      });

      return buildInvalidationResult({
        requestId: ctx.requestId, // echo request id back to GraphQL client
        scope: 'controls', // mutation invalidated controls reads
        invalidatedPrefix // return exact prefix for easy verification
      });
    },

    adminInvalidateFaqsReads: async (
      _parent: unknown,
      _args: unknown,
      ctx: MutationContext
    ): Promise<InvalidationResult> => {
      assertAdminOrLocalDev(ctx); // allow local verification now while keeping production restricted

      const invalidatedPrefix = invalidateFaqs(ctx.cache); // clear all cached faq list reads

      logInvalidation({
        requestId: ctx.requestId, // tie invalidation log to this GraphQL request
        scope: 'faqs', // domain being invalidated
        prefix: invalidatedPrefix // exact prefix used by cache invalidation
      });

      return buildInvalidationResult({
        requestId: ctx.requestId, // echo request id back to GraphQL client
        scope: 'faqs', // mutation invalidated faq reads
        invalidatedPrefix // return exact prefix for easy verification
      });
    },

    adminCreateControl: async (
      _parent: unknown,
      args: { input: CreateControlInput },
      ctx: GraphQLContext
    ) => {
      assertAdminOrLocalDev(ctx); // auth stays at the resolver boundary
      const row = await createControl(args.input, ctx); // service validates, writes, recomputes search_text, and invalidates
      return mapControlNode(row); // GraphQL node mapping stays centralized and symmetric
    },

    adminUpdateControl: async (
      _parent: unknown,
      args: { id: string; input: UpdateControlInput },
      ctx: GraphQLContext
    ) => {
      assertAdminOrLocalDev(ctx); // auth stays at the resolver boundary
      const row = await updateControl(args.id, args.input, ctx); // service validates, writes, recomputes search_text, and invalidates
      return mapControlNode(row); // GraphQL node mapping stays centralized and symmetric
    },

    adminDeleteControl: async (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext
    ): Promise<DeleteResult> => {
      assertAdminOrLocalDev(ctx); // auth stays at the resolver boundary
      const deleted = await deleteControl(args.id, ctx); // service deletes and invalidates
      return buildDeleteResult({
        requestId: ctx.requestId,
        id: deleted.id
      }); // delete payload stays tiny and reviewer-friendly
    },

    adminCreateFaq: async (
      _parent: unknown,
      args: { input: CreateFaqInput },
      ctx: GraphQLContext
    ) => {
      assertAdminOrLocalDev(ctx); // auth stays at the resolver boundary
      const row = await createFaq(args.input, ctx); // service validates, writes, recomputes search_text, and invalidates
      return mapFaqNode(row); // GraphQL node mapping stays centralized and symmetric
    },

    adminUpdateFaq: async (
      _parent: unknown,
      args: { id: string; input: UpdateFaqInput },
      ctx: GraphQLContext
    ) => {
      assertAdminOrLocalDev(ctx); // auth stays at the resolver boundary
      const row = await updateFaq(args.id, args.input, ctx); // service validates, writes, recomputes search_text, and invalidates
      return mapFaqNode(row); // GraphQL node mapping stays centralized and symmetric
    },

    adminDeleteFaq: async (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext
    ): Promise<DeleteResult> => {
      assertAdminOrLocalDev(ctx); // auth stays at the resolver boundary
      const deleted = await deleteFaq(args.id, ctx); // service deletes and invalidates
      return buildDeleteResult({
        requestId: ctx.requestId,
        id: deleted.id
      }); // delete payload stays tiny and reviewer-friendly
    }
  }
};
