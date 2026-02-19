/* ================================
  TL;DR  -->  types only found in the frontend

  - declares ui-facing node shapes
  - declares graphql connection shapes used by fetch wrappers
  - declares jsx typing for stencil custom elements (react + ts)
================================ */

import type * as React from 'react';

// ----------  graphql node shapes (ui contract)  ----------

export type Control = {
  id: string; // uuid (or stable key)
  title: string; // short name for bullet display
  description: string; // long text
  category: string; // grouping key
  sourceUrl: string | null; // optional reference url
  updatedAt: string; // iso timestamp (or placeholder in seed mode)
};

export type Faq = {
  id: string; // uuid (or stable key)
  question: string; // user-facing question
  answer: string; // user-facing answer
  category: string; // grouping key
  updatedAt: string; // iso timestamp (or placeholder in seed mode)
};

// ----------  graphql connection shapes (ui contract)  ----------

export type PageInfo = {
  hasNextPage: boolean; // pagination flag
  endCursor: string | null; // next cursor
};

export type ControlEdge = {
  cursor: string; // opaque cursor
  node: Control; // node payload
};

export type ControlsConnection = {
  edges: ControlEdge[]; // connection list
  pageInfo: PageInfo; // pagination metadata
  totalCount: number; // filtered count
};

export type FaqEdge = {
  cursor: string; // opaque cursor
  node: Faq; // node payload
};

export type FaqsConnection = {
  edges: FaqEdge[]; // connection list
  pageInfo: PageInfo; // pagination metadata
  totalCount: number; // filtered count
};

// ----------  jsx custom element typing (react + ts)  ----------
// note:
// - with "jsx": "react-jsx", ts reads intrinsic elements from "react/jsx-runtime"
// - so we augment that module (and "react" as a backup)

type HtmlElProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement>,
  HTMLElement
>;

type AonLinkCardProps = HtmlElProps & {
  'link-card-title'?: string;
  // REVIEW: This interface appears stale vs current usage (`link-title` + `items`); update typings to match actual web component API.

  'link-one-label'?: string;
  'link-one-href'?: string;

  'link-two-label'?: string;
  'link-two-href'?: string;

  'link-three-label'?: string;
  'link-three-href'?: string;
};

type AonExpansionCardProps = HtmlElProps & {
  'card-title'?: string;
  'bullet-points-json'?: string;
  'icon-src'?: string;
  'preview-limit'?: number | string;
};

type AonBlueCardProps = HtmlElProps & {
  'blue-card-title'?: string;
  'blue-card-description'?: string;
  'blue-card-footer-label'?: string;
  'blue-card-footer-link'?: string;
  // REVIEW: Prop names look outdated (`footer-*`) compared with current attributes (`blue-card-button-text` / `blue-card-button-link`); this weakens type safety.
};

type AonFooterProps = HtmlElProps & {
  'logo-src'?: string;
  'footer-tagline'?: string;
  'footer-link-label'?: string;
  'footer-link-href'?: string;
};

interface AonStencilIntrinsicElements {
  // overview
  'aon-link-card': AonLinkCardProps;
  'aon-expansion-card': AonExpansionCardProps;
  'aon-blue-card': AonBlueCardProps;

  // layout (used in app.tsx)
  'aon-header': HtmlElProps;
  'aon-title': HtmlElProps;
  'aon-navbar': HtmlElProps;
  'aon-footer': AonFooterProps;

  // common in other sections
  'aon-control-card': HtmlElProps;
  'aon-faq-card': HtmlElProps;
  'aon-subnav-card': HtmlElProps;
}

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements extends AonStencilIntrinsicElements {}
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends AonStencilIntrinsicElements {}
  }
}

export {};
