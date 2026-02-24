/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  admin mutation resolver stubs (not wired yet)

  - placeholder resolver map for future Admin GUI mutations
  - shows the invalidation pattern: write to DB → invalidate cache → return result
  - every method throws "not implemented" until real DB mutations are built
  - wire into schema.ts + resolvers.ts when Admin GUI work begins (EPIC 005-T.f)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { invalidateControls, invalidateFaqs } from '../cache/invalidation'; // entity invalidators
import type { Cache } from '../cache/cache'; // cache type used in context shape

// minimal context shape needed here — just cache + auth
// matches the GraphQLContext that will carry cache once T.a (context refactor) lands
type MutationContext = {
  cache: Cache; // the shared process-level cache instance
  requestId: string; // for tracing — log this on every mutation
  auth: { isAdmin: boolean }; // guard: only admins can call these
};

// ----------  mutation resolver map  ----------

export const mutationResolvers = {
  Mutation: {
    // stub: upsert (create or update) a control record
    // pattern: validate → write DB → invalidate controls cache → return updated record
    adminControlUpsert: async (
      _parent: unknown,
      _args: unknown,
      ctx: MutationContext
    ): Promise<never> => {
      if (!ctx.auth.isAdmin) throw new Error('FORBIDDEN: admin only'); // auth guard
      invalidateControls(ctx.cache); // wipe controls cache so next read is fresh from DB
      // TODO: implement DB upsert (EPIC 005-T.b service layer)
      throw new Error('adminControlUpsert: not implemented');
    },

    // stub: upsert a faq record
    adminFaqUpsert: async (
      _parent: unknown,
      _args: unknown,
      ctx: MutationContext
    ): Promise<never> => {
      if (!ctx.auth.isAdmin) throw new Error('FORBIDDEN: admin only'); // auth guard
      invalidateFaqs(ctx.cache); // wipe faqs cache so next read is fresh from DB
      // TODO: implement DB upsert (EPIC 005-T.b service layer)
      throw new Error('adminFaqUpsert: not implemented');
    },

    // stub: hard-delete a control record by id
    adminControlDelete: async (
      _parent: unknown,
      _args: unknown,
      ctx: MutationContext
    ): Promise<never> => {
      if (!ctx.auth.isAdmin) throw new Error('FORBIDDEN: admin only'); // auth guard
      invalidateControls(ctx.cache); // delete also makes cached lists stale
      // TODO: implement DB delete (EPIC 005-T.b service layer)
      throw new Error('adminControlDelete: not implemented');
    },

    // stub: hard-delete a faq record by id
    adminFaqDelete: async (
      _parent: unknown,
      _args: unknown,
      ctx: MutationContext
    ): Promise<never> => {
      if (!ctx.auth.isAdmin) throw new Error('FORBIDDEN: admin only'); // auth guard
      invalidateFaqs(ctx.cache); // delete also makes cached lists stale
      // TODO: implement DB delete (EPIC 005-T.b service layer)
      throw new Error('adminFaqDelete: not implemented');
    }
  }
};
