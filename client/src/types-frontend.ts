/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  frontend-only types + react/stencil jsx typing

  - declares ui-facing node + connection shapes
  - declares stencil custom element props for react tsx usage
  - intentionally excludes asset module declarations (see assets.d.ts)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React from 'react';

// ----------  graphql node types (ui-facing)  ----------

export type Control = {
  id: string; // graphql id
  controlKey?: string; // returned by graphql (optional for backwards compatibility)
  title: string; // display label
  category: string; // grouping key
  status?: string; // optional ui-only field (if ever added client-side)
  description?: string; // optional long text
  sourceUrl?: string | null; // optional source link from graphql
  updatedAt?: string; // iso timestamp (graphql)
};

export type Faq = {
  id: string; // graphql id
  faqKey?: string; // returned by graphql (optional for backwards compatibility)
  question: string; // faq title/question
  answer: string; // faq answer
  category?: string; // graphql returns category (optional for backwards compatibility)
  updatedAt?: string; // iso timestamp (graphql)
};

// ----------  generic connection types  ----------

export type PageInfo = {
  hasNextPage: boolean; // pagination flag
  endCursor: string | null; // cursor for next page
};

export type Edge<T> = {
  cursor: string; // edge cursor
  node: T; // edge payload
};

export type Connection<T> = {
  edges: Array<Edge<T>>; // paginated list
  pageInfo: PageInfo; // pagination metadata
  totalCount: number; // total matching rows (server resolver returns this)
};

export type ControlsConnection = Connection<Control>;
export type FaqsConnection = Connection<Faq>;

// ----------  reusable link-card item types (react composition)  ----------

export type LinkCardItem = {
  label: string; // row label shown in the card
  href: string; // local pdf url or external url
  iconSrc?: string; // optional icon url
  iconAlt?: string; // optional icon alt text
};

export type LinkCardConfig = {
  title: string; // aon-link-card title
  items: LinkCardItem[]; // serialized into the items prop
};

// ----------  react intrinsic typing helpers  ----------

type HtmlElProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement>,
  HTMLElement
>;

// ----------  stencil custom element prop typings ----------
// NOTE:
// - keep these aligned with the actual @Prop() names in stencil components
// - kebab-case here because react passes attributes to custom elements

type AonLinkCardProps = HtmlElProps & {
  'link-title'?: string;
  items?: string; // JSON string consumed by stencil component
};

type AonExpansionCardProps = HtmlElProps & {
  'data-mode'?: 'static' | 'controls' | string;

  'icon-src'?: string;
  'preview-limit'?: number | string;

  'card-title'?: string;
  'bullet-points-json'?: string;

  'fetch-first'?: number | string;
  'category-limit'?: number | string;
  'show-tile'?: boolean;
  'tile-title'?: string;
  'show-meta'?: boolean;
  'tile-subtitle'?: string;

  // optional client-fed data props (overview controls mode is prop-driven)
  'controls-json'?: string;
  'is-loading'?: boolean;
  'error-text'?: string;
};

type AonBlueCardProps = HtmlElProps & {
  'blue-card-title'?: string;
  'blue-card-description'?: string;
  'blue-card-button-text'?: string;
  'blue-card-button-link'?: string;
};

type AonFooterProps = HtmlElProps & {
  'logo-src'?: string;
  'footer-tagline'?: string;
  'footer-link-label'?: string;
  'footer-link-href'?: string;
};

type AonControlCardProps = HtmlElProps & {
  'data-mode'?: 'controls' | 'none' | string;
  'fetch-first'?: number | string;
  'show-tile'?: boolean;
  'title-text'?: string;
  'show-meta'?: boolean;
  'subtitle-text'?: string;
  'icon-src'?: string;

  // optional client-fed data props (react owns fetch)
  'controls-json'?: string;
  'is-loading'?: boolean;
  'error-text'?: string;
};

type AonFaqCardProps = HtmlElProps & {
  'data-mode'?: 'faqs' | 'single' | 'none' | string;
  'fetch-first'?: number | string;
  'show-header'?: boolean;
  'question-text'?: string;
  'answer-text'?: string;
  'show-tile'?: boolean;
  'title-text'?: string;
  'show-meta'?: boolean;
  'subtitle-text'?: string;

  // optional client-fed data props (if your stencil refactor added them)
  'faqs-json'?: string;
};

interface AonStencilIntrinsicElements {
  'aon-link-card': AonLinkCardProps;
  'aon-expansion-card': AonExpansionCardProps;
  'aon-blue-card': AonBlueCardProps;

  'aon-header': HtmlElProps;
  'aon-title': HtmlElProps;
  'aon-navbar': HtmlElProps;
  'aon-footer': AonFooterProps;

  'aon-control-card': AonControlCardProps;
  'aon-faq-card': AonFaqCardProps;
  'aon-subnav-card': HtmlElProps;
}

// react 18 jsx runtime intrinsic element augmentation
declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements extends AonStencilIntrinsicElements {}
  }
}

export {};
