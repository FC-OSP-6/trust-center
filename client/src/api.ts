/* ================================
  TL;DR  -->  connection to backend graphQL route

      - send typed graphql requests through /graphql
      - keep error surfaces readable for mvp debugging
      - export page fetch helpers used by ui sections
================================ */

// TODO: fetchControlsConnectionPage/fetchFaqsConnectionPage are mostly duplicated; consider a generic connection fetch helper to keep this DRY.

import type { ControlsConnection, FaqsConnection } from './types-frontend';

// ----------  graphql fetch wrapper  ----------

type GraphqlFetchArgs<TVars> = {
  query: string; // graphql document string
  variables?: TVars; // graphql variables
};

type GraphqlResponse<TData> = {
  data?: TData; // success payload
  errors?: Array<{ message?: string }>; // graphql error list
};

export async function graphqlFetch<TData, TVars>(
  args: GraphqlFetchArgs<TVars>
): Promise<{ data: TData }> {
  // request config
  const url = '/graphql'; // dev proxy expects relative url

  // fetch may throw on network failures
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: args.query,
        variables: args.variables ?? {}
      })
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown network error';
    throw new Error(`NETWORK_ERROR: ${msg}`);
  }

  // non-2xx should still surface cleanly
  if (!res.ok) {
    throw new Error(`NETWORK_ERROR: http ${res.status}`);
  }

  // parse json once
  const json = (await res.json()) as GraphqlResponse<TData>;

  // graphql-level errors return 200 with errors[]
  if (json.errors && json.errors.length) {
    const msg = json.errors
      .map(e => e.message ?? 'unknown graphql error')
      .join(' | ');
    throw new Error(`GRAPHQL_ERROR: ${msg}`);
  }

  // missing data is still a failure
  if (!json.data) {
    throw new Error('GRAPHQL_ERROR: missing data');
  }

  return { data: json.data };
}

// ----------  query documents  ----------

export const CONTROLS_CONNECTION_QUERY = /* GraphQL */ `
  query ControlsConnection(
    $first: Int!
    $after: String
    $category: String
    $search: String
  ) {
    controlsConnection(
      first: $first
      after: $after
      category: $category
      search: $search
    ) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
        node {
          id
          title
          description
          category
          sourceUrl
          updatedAt
        }
      }
    }
  }
`;

export const FAQS_CONNECTION_QUERY = /* GraphQL */ `
  query FaqsConnection(
    $first: Int!
    $after: String
    $category: String
    $search: String
  ) {
    faqsConnection(
      first: $first
      after: $after
      category: $category
      search: $search
    ) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
        node {
          id
          question
          answer
          category
          updatedAt
        }
      }
    }
  }
`;

// ----------  page helpers  ----------

type FetchConnectionArgs = {
  first: number; // page size
  after?: string; // cursor
  category?: string; // filter
  search?: string; // search term
};

type ControlsConnectionData = {
  controlsConnection: ControlsConnection;
};

type FaqsConnectionData = {
  faqsConnection: FaqsConnection;
};

function normalizeText(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  return trimmed;
}

export async function fetchControlsConnectionPage(
  args: FetchConnectionArgs
): Promise<ControlsConnection> {
  // normalize inputs
  const variables = {
    first: args.first,
    after: args.after,
    category: normalizeText(args.category),
    search: normalizeText(args.search)
  };

  // call graphql
  const res = await graphqlFetch<ControlsConnectionData, typeof variables>({
    query: CONTROLS_CONNECTION_QUERY,
    variables
  });

  return res.data.controlsConnection;
}

export async function fetchFaqsConnectionPage(
  args: FetchConnectionArgs
): Promise<FaqsConnection> {
  // normalize inputs
  const variables = {
    first: args.first,
    after: args.after,
    category: normalizeText(args.category),
    search: normalizeText(args.search)
  };

  // call graphql
  const res = await graphqlFetch<FaqsConnectionData, typeof variables>({
    query: FAQS_CONNECTION_QUERY,
    variables
  });

  return res.data.faqsConnection;
}
