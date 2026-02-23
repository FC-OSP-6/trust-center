/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  frontend-only types + react/stencil jsx typing

  - declares ui-facing node + connection shapes
  - declares stencil custom element props for react tsx usage
  - keeps custom element prop names aligned with current stencil @Prop() APIs
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

// ----------  stencil custom element prop typings  ----------
// use kebab-case here because react passes attributes to custom elements

type AonLinkCardProps = HtmlElProps & {
  'link-title'?: string;
  items?: string; // json string consumed by stencil component
};

type AonExpansionCardProps = HtmlElProps & {
  'data-mode'?: 'static' | 'controls' | string;

  'icon-src'?: string;
  'preview-limit'?: number | string;

  'is-loading'?: boolean;
  'error-text'?: string;

  'card-title'?: string;
  'bullet-points-json'?: string;

  'category-limit'?: number | string;
  'show-tile'?: boolean;
  'tile-title'?: string;
  'show-meta'?: boolean;
  'tile-subtitle'?: string;

  'controls-json'?: string; // react -> stencil controls payload
};

type AonBlueCardProps = HtmlElProps & {
  'blue-card-title'?: string;
  'blue-card-description'?: string;
  'blue-card-button-text'?: string;
  'blue-card-button-link'?: string;
};

type AonTitleProps = HtmlElProps & {
  'trust-center-name'?: string;
  'support-message'?: string;
  'support-email'?: string;
  'support-email-subject'?: string;
};

type AonNavbarProps = HtmlElProps & {
  'items-json'?: string; // react passes serialized navbar items
  'active-path'?: string; // react passes current pathname
  'nav-aria-label'?: string; // optional aria label
};

type AonFooterProps = HtmlElProps & {
  'logo-src'?: string;
  'logo-alt'?: string;

  copyright?: string;

  'privacy-policy-href'?: string;
  'privacy-policy-label'?: string;

  'terms-href'?: string;
  'terms-label'?: string;
};

type AonControlCardProps = HtmlElProps & {
  'data-mode'?: 'controls' | 'none' | string;
  'show-tile'?: boolean;
  'title-text'?: string;
  'show-meta'?: boolean;
  'subtitle-text'?: string;
  'icon-src'?: string;

  'controls-json'?: string; // react -> stencil controls payload
  'is-loading'?: boolean; // react -> stencil loading state
  'error-text'?: string; // react -> stencil error state

  'section-id-prefix'?: string; // api-driven subnav anchor target prefix
};

type AonFaqCardProps = HtmlElProps & {
  'data-mode'?: 'faqs' | 'single' | 'none' | string;
  'show-tile'?: boolean;
  'title-text'?: string;
  'show-meta'?: boolean;
  'subtitle-text'?: string;
  'icon-src'?: string;

  question?: string; // single mode prop
  answer?: string; // single mode prop

  'faqs-json'?: string; // react -> stencil faqs payload
  'is-loading'?: boolean; // react -> stencil loading state
  'error-text'?: string; // react -> stencil error state

  'section-id-prefix'?: string; // api-driven subnav anchor target prefix
};

type AonSubnavCardProps = HtmlElProps & {
  'subnav-card-title'?: string;
  'items-json'?: string; // react passes serialized subnav items
  'empty-text'?: string; // optional empty state text
};

interface AonStencilIntrinsicElements {
  'aon-link-card': AonLinkCardProps;
  'aon-expansion-card': AonExpansionCardProps;
  'aon-blue-card': AonBlueCardProps;

  'aon-header': HtmlElProps;
  'aon-title': AonTitleProps;
  'aon-navbar': AonNavbarProps;
  'aon-footer': AonFooterProps;

  'aon-control-card': AonControlCardProps;
  'aon-faq-card': AonFaqCardProps;
  'aon-subnav-card': AonSubnavCardProps;
}

// react 18 jsx runtime intrinsic element augmentation
declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements extends AonStencilIntrinsicElements {}
  }
}

export {};
