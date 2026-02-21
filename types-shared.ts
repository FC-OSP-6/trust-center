/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  shared contracts for FE + BE + graphql wrappers

  - centralizes connection/page types used by client + server-facing adapters
  - reduces schema drift between frontend api helpers and backend graphql shape
  - keeps ui-only jsx/web-component typing out of shared contracts
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

export type PageInfo = {
  hasNextPage: boolean; // relay-style page flag
  endCursor: string | null; // relay-style cursor for next page
};

export type Edge<TNode> = {
  cursor: string; // cursor for this node edge
  node: TNode; // data payload for this row
};

export type Connection<TNode> = {
  edges: Array<Edge<TNode>>; // ordered page rows
  pageInfo: PageInfo; // pagination state
  totalCount: number; // total rows matching filters
};

export type Control = {
  id: string; // stable id from db or seed fallback
  title: string; // display title
  category: string; // grouping key
  description?: string; // optional because some queries omit it
  sourceUrl?: string | null; // optional because some queries omit it
  updatedAt?: string; // optional because some queries omit it
  controlKey?: string; // optional because some queries omit it
  status?: string; // ui-only legacy support if still referenced
};

export type Faq = {
  id: string; // stable id from db or seed fallback
  question: string; // display question
  answer: string; // display answer
  category?: string; // optional because some query selections may omit it
  updatedAt?: string; // optional because some queries omit it
  faqKey?: string; // optional because some queries omit it
};

export type ControlsConnection = Connection<Control>; // typed alias for controls pages
export type FaqsConnection = Connection<Faq>; // typed alias for faq pages
