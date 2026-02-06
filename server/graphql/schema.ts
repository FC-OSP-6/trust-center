/* ================================
  TL;DR  -->  graphql schema (sdl)

  - defines read-only queries for controls + faqs
  - defines connection/pageinfo for pagination
  - preserves debug fields for early boot verification
  - documents future-only stubs as comments (not executable yet)
================================ */


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
    category: String!
    sourceUrl: String
    updatedAt: String!
  }

  type Faq {
    id: ID!
    faqKey: String!
    question: String!
    answer: String!
    category: String!
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

  # ----------  root query  ----------

  type Query {
    # debug-only sanity checks  -->  keeps schema boot checks simple
    hello: String!
    health: String!
    debugContext: DebugContext!

    # mvp read-only connections  -->  frontend contract
    controlsConnection(first: Int!, after: String, category: String, search: String): ControlConnection!
    faqsConnection(first: Int!, after: String, category: String, search: String): FaqConnection!
  }

  # ----------  FUTURE-ONLY STUBS (COMMENTS ONLY)  ----------

  # type Mutation {
  #   adminControlUpsert(...)
  #   adminFaqUpsert(...)
  #   adminControlDelete(...)
  #   adminFaqDelete(...)
  # }

  # type Query {
  #   aiAnswer(question: String!): AiAnswerResponse!
  # }
`;
