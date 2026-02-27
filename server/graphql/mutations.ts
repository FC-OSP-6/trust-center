/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  admin-ready cache invalidation mutations

  - exposes safe GraphQL mutation hooks for read-cache invalidation
  - keeps invalidation callable before real admin writes exist
  - preserves the future write pattern: write db first, then invalidate reads
  - allows local verification in non-production while auth is still a stub
  - returns structured mutation results so GraphiQL checks are easy to verify
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import type { GraphQLContext } from './context'; // shared GraphQL context contract
import { invalidateControls, invalidateFaqs } from '../cache/invalidation'; // domain-level invalidation helpers

// ---------- local mutation context ----------

type MutationContext = Pick<GraphQLContext, 'cache' | 'requestId' | 'auth'>; // only the fields this file actually needs

type InvalidationScope = 'controls' | 'faqs'; // supported invalidation domains

type InvalidationResult = {
  ok: boolean; // success flag for GraphQL clients and GraphiQL smoke tests
  scope: InvalidationScope; // which domain was invalidated
  invalidatedPrefix: string; // exact prefix that was cleared
  requestId: string; // request trace id for terminal correlation
};

// ---------- constants ----------

const CONTROLS_LIST_PREFIX = 'controls:list:'; // list-read prefix for controls cache keys
const FAQS_LIST_PREFIX = 'faqs:list:'; // list-read prefix for faqs cache keys

// ---------- helpers ----------

function assertAdminOrLocalDev(ctx: MutationContext): void {
  const isLocalDev = process.env.NODE_ENV !== 'production'; // local dev has no real auth yet, so allow verification outside production

  if (!ctx.auth.isAdmin && !isLocalDev) {
    throw new Error('FORBIDDEN: admin only'); // production still requires real admin auth
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

// ---------- mutation resolvers ----------

export const mutationResolvers = {
  Mutation: {
    adminInvalidateControlsReads: async (
      _parent: unknown,
      _args: unknown,
      ctx: MutationContext
    ): Promise<InvalidationResult> => {
      assertAdminOrLocalDev(ctx); // allow local verification now while keeping production restricted

      invalidateControls(ctx.cache); // clear all cached controls list reads

      logInvalidation({
        requestId: ctx.requestId, // tie invalidation log to this GraphQL request
        scope: 'controls', // domain being invalidated
        prefix: CONTROLS_LIST_PREFIX // exact prefix used by cache invalidation
      });

      return buildInvalidationResult({
        requestId: ctx.requestId, // echo request id back to GraphQL client
        scope: 'controls', // mutation invalidated controls reads
        invalidatedPrefix: CONTROLS_LIST_PREFIX // return exact prefix for easy verification
      });
    },

    adminInvalidateFaqsReads: async (
      _parent: unknown,
      _args: unknown,
      ctx: MutationContext
    ): Promise<InvalidationResult> => {
      assertAdminOrLocalDev(ctx); // allow local verification now while keeping production restricted

      invalidateFaqs(ctx.cache); // clear all cached faq list reads

      logInvalidation({
        requestId: ctx.requestId, // tie invalidation log to this GraphQL request
        scope: 'faqs', // domain being invalidated
        prefix: FAQS_LIST_PREFIX // exact prefix used by cache invalidation
      });

      return buildInvalidationResult({
        requestId: ctx.requestId, // echo request id back to GraphQL client
        scope: 'faqs', // mutation invalidated faq reads
        invalidatedPrefix: FAQS_LIST_PREFIX // return exact prefix for easy verification
      });
    }
  }
};

// ---------- future admin-write notes ----------

// future admin writes should follow this order: validate auth -> write db -> invalidate reads -> return payload
// future controls writes should call invalidateControls(ctx.cache) only after the db write succeeds
// future faq writes should call invalidateFaqs(ctx.cache) only after the db write succeeds
