/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  admin auth extraction helpers

  - derives demo-grade admin state from request headers
  - keeps auth logic out of resolvers/services
  - compares x-admin-token against ADMIN_SECRET from env
  - returns the same auth shape the graphql context already expects
  - intentionally stays tiny and deterministic until real auth lands
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

// ---------- auth contract ----------

export type AuthState = {
  userEmail: string | null; // null for anonymous/non-admin requests
  roles: string[]; // empty for anonymous requests; ['admin'] for demo admin requests
  isAdmin: boolean; // drives admin-only mutation access
};

// ---------- constants ----------

const ADMIN_TOKEN_HEADER = 'x-admin-token'; // demo-only header used by GraphiQL and local verification

// ---------- helpers ----------

function getAdminSecret(): string | null {
  const raw = String(process.env.ADMIN_SECRET ?? '').trim(); // read once from env and normalize accidental whitespace
  return raw === '' ? null : raw; // empty/missing env should never authorize admin access
}

function getHeaderValue(request: Request, headerName: string): string | null {
  const value = request.headers.get(headerName); // Request headers are case-insensitive in the fetch Headers API
  if (value == null) return null; // missing header means no admin token was provided

  const normalized = value.trim(); // tolerate accidental spaces from manual GraphiQL entry
  return normalized === '' ? null : normalized; // blank header should behave the same as no header
}

function buildAnonymousAuth(): AuthState {
  return {
    userEmail: null, // anonymous request has no resolved identity
    roles: [], // anonymous request has no roles
    isAdmin: false // default deny for all requests unless the demo token matches
  };
}

// ---------- public api ----------

export function extractAuth(request: Request): AuthState {
  const adminSecret = getAdminSecret(); // demo secret must come from env, never source code
  const providedToken = getHeaderValue(request, ADMIN_TOKEN_HEADER); // read the request header once

  if (!adminSecret || !providedToken) {
    return buildAnonymousAuth(); // missing env or missing header should never elevate privileges
  }

  if (providedToken !== adminSecret) {
    return buildAnonymousAuth(); // mismatched token should stay non-admin without leaking secret details
  }

  return {
    userEmail: 'admin@local', // demo-only identity keeps debug output readable in local verification
    roles: ['admin'], // minimal role list keeps future RBAC extension straightforward
    isAdmin: true // matched token yields admin capability
  };
}
