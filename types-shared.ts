/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  shared contracts for FE + BE + graphql wrappers

  - centralizes connection/page types used by client + server-facing adapters
  - reduces schema drift between frontend api helpers and backend graphql shape
  - keeps ui-only jsx/web-component typing out of shared contracts
  - includes grouped overview-search contracts so 006E can consume the same backend shape
  - includes lightweight grouped ui shapes used by stencil renderers
  - leaves new taxonomy metadata optional so current consumers do not break
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

export type ConnectionQueryArgs = {
  first: number; // page size requested by the caller
  after?: string; // optional cursor boundary
  category?: string; // optional category filter
  search?: string; // optional substring search term
};

export type OverviewSearchQueryArgs = {
  search: string; // grouped overview search term
  firstPerKind?: number; // per-entity visible row cap for grouped overview results
};

export type Control = {
  id: string; // stable id from db or seed fallback
  title: string; // display title
  category: string; // grouping key
  section?: string; // broad taxonomy bucket (optional for compatibility)
  subcategory?: string | null; // fine-grained taxonomy bucket
  tags?: string[]; // optional because existing client queries may omit it
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
  section?: string; // broad taxonomy bucket (optional for compatibility)
  subcategory?: string | null; // fine-grained taxonomy bucket
  tags?: string[]; // optional because some queries omit it
  updatedAt?: string; // optional because some queries omit it
  faqKey?: string; // optional because some queries omit it
};

export type ControlsConnection = Connection<Control>; // typed alias for controls pages
export type FaqsConnection = Connection<Faq>; // typed alias for faq pages

export type OverviewSearchResult = {
  search: string; // normalized search term echoed back by the backend
  controls: ControlsConnection; // grouped controls bucket for overview search
  faqs: FaqsConnection; // grouped faqs bucket for overview search
  totalCount: number; // sum of controls.totalCount + faqs.totalCount
};

// ----------  grouped UI helper types (used by stencil components)  ----------

export type ControlGroupItem = {
  id: string; // stable id for row key + toggles
  title: string; // control title shown in grouped list
  description: string; // normalized description string (may be empty)
};

export type ControlGroup = {
  title: string; // category title rendered as group/card title
  items: ControlGroupItem[]; // controls belonging to this category
};

export type FaqGroupItem = {
  id: string; // stable id for row key + expand state
  question: string; // faq question shown in row header
  answer: string; // faq answer revealed on expand
};

export type FaqGroup = {
  title: string; // category title rendered as group/card title
  items: FaqGroupItem[]; // faqs belonging to this category
};

export type ExpansionControlGroup = {
  category: string; // category heading rendered in overview expansion cards
  titles: string[]; // sorted control titles shown under the category
};
