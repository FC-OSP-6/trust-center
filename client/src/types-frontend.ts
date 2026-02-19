/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  types only found in the frontend

  - declares ui-facing node shapes
  - declares graphql connection shapes used by fetch wrappers
  - declares jsx typing for stencil custom elements (react + ts)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React from 'react';

export type Control = {
  id: string;
  title: string;
  category: string;
  status?: string;
  description?: string;
};

export type Faq = {
  id: string;
  question: string;
  answer: string;
};

export type PageInfo = {
  hasNextPage: boolean;
  endCursor: string | null;
};

export type Edge<T> = {
  cursor: string;
  node: T;
};

export type Connection<T> = {
  edges: Array<Edge<T>>;
  pageInfo: PageInfo;
};

export type ControlsConnection = Connection<Control>;
export type FaqsConnection = Connection<Faq>;

type HtmlElProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement>,
  HTMLElement
>;

type AonLinkCardProps = HtmlElProps & {
  'link-title'?: string;
  items?: string;
};

type AonExpansionCardProps = HtmlElProps & {
  /* mode switch */
  'data-mode'?: 'static' | 'controls' | string;

  /* shared */
  'icon-src'?: string;
  'preview-limit'?: number | string;

  /* static mode */
  'card-title'?: string;
  'bullet-points-json'?: string;

  /* controls mode */
  'fetch-first'?: number | string;
  'category-limit'?: number | string;
  'show-tile'?: boolean;
  'tile-title'?: string;
  'show-meta'?: boolean;
  'tile-subtitle'?: string;
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
};

type AonFaqCardProps = HtmlElProps & {
  'data-mode'?: 'faqs' | 'single' | 'none' | string;
  'fetch-first'?: number | string;
  'show-header'?: boolean;
  'question-text'?: string;
  'answer-text'?: string;
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

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements extends AonStencilIntrinsicElements {}
  }
}

export {};
