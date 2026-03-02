/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  graphql schema (sdl)

  - defines read-only queries for controls + faqs
  - defines connection/pageInfo for pagination
  - exposes debug fields for boot/runtime verification
  - exposes admin-ready cache invalidation mutations
  - exposes taxonomy metadata without breaking current query args
  - adds a grouped overview search contract for later frontend consumers
  - keeps future AI/query ideas as comments only until implemented
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

export const typeDefs = /* GraphQL */ `
  # ----------  debug primitives  ----------

  type DebugContext {
    requestId: String!
    isAdmin: Boolean!
  }

  # ----------  pagination primitives  ----------

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  # ----------  nodes  ----------

  type Control {
    id: ID!
    controlKey: String!
    title: String!
    description: String!
    section: String!
    category: String!
    subcategory: String
    tags: [String!]!
    sourceUrl: String
    updatedAt: String!
  }

  type Faq {
    id: ID!
    faqKey: String!
    question: String!
    answer: String!
    section: String!
    category: String!
    subcategory: String
    tags: [String!]!
    updatedAt: String!
  }

  # ----------  connections  ----------

  type ControlEdge {
    cursor: String!
    node: Control!
  }

  type ControlConnection {
    edges: [ControlEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type FaqEdge {
    cursor: String!
    node: Faq!
  }

  type FaqConnection {
    edges: [FaqEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type OverviewSearchResult {
    search: String!
    controls: ControlConnection!
    faqs: FaqConnection!
    totalCount: Int!
  }

  # ----------  mutation payloads  ----------

  type InvalidationResult {
    ok: Boolean!
    scope: String!
    invalidatedPrefix: String!
    requestId: String!
  }

  # ----------  root query  ----------

  type Query {
    # debug-only sanity checks  -->  keeps schema boot checks simple
    hello: String!
    health: String!
    debugContext: DebugContext!

    # mvp read-only connections  -->  frontend contract
    controlsConnection(
      first: Int!
      after: String
      category: String
      search: String
    ): ControlConnection!
    faqsConnection(
      first: Int!
      after: String
      category: String
      search: String
    ): FaqConnection!

    # grouped overview search  -->  small backend contract for the overview page
    overviewSearch(
      search: String!
      firstPerKind: Int = 5
    ): OverviewSearchResult!
  }

  # ----------  root mutation  ----------

  type Mutation {
    # admin-ready cache invalidation hooks  -->  safe to verify before real writes land
    adminInvalidateControlsReads: InvalidationResult!
    adminInvalidateFaqsReads: InvalidationResult!
  }

  # ----------  FUTURE-ONLY NOTES (COMMENTS ONLY)  ----------

  # future admin writes should use: write db -> invalidate reads -> return payload
  # future ai work may add: aiAnswer(question: String!): AiAnswerResponse!
`;
