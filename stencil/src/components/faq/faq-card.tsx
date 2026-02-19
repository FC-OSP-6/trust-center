/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  --> FAQ cards (stencil-owned data + behavior)

  goals:
  - keep react dumb  --> stencil fetches + groups + expands/collapses
  - reuse the same +/- and reveal behavior as controls (via shared css primitives)
  - show loading + error + empty states so ui never fails silently

  modes:
  - data-mode="faqs": fetches faqsConnection from /graphql, groups by category, renders page ui
  - data-mode="single": renders one question/answer pair (backwards compatible)

  note:
  - per-item expansion state is internal to stencil
  - graphql schema does NOT expose sourceUrl for Faq  --> do not query it
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { Component, Prop, State, h } from '@stencil/core';

// ---------- local types ----------

type FaqNode = {
  id: string;
  question: string;
  answer: string;
  category: string;
  updatedAt: string;
};

type FaqsConnectionResponse = {
  data?: {
    faqsConnection?: {
      totalCount?: number;
      edges?: Array<{ node?: FaqNode }>;
    };
  };
  errors?: Array<{ message?: string }>;
};

type CategoryGroup = {
  title: string;
  items: Array<{ id: string; question: string; answer: string }>;
};

// ---------- graphql doc ----------

const FAQS_CONNECTION_QUERY = `
  query FaqsConnection($first: Int!, $after: String, $category: String, $search: String) {
    faqsConnection(first: $first, after: $after, category: $category, search: $search) {
      totalCount
      edges {
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

@Component({
  tag: 'aon-faq-card',
  styleUrl: 'faq-card.css',
  shadow: true
})
export class FaqCard {
  // ---------- public api ----------

  @Prop({ attribute: 'data-mode' }) dataMode: 'faqs' | 'single' | 'none' =
    'none';

  @Prop({ attribute: 'fetch-first' }) fetchFirst: number = 25;

  // optional tile header (matches controls strategy)
  @Prop({ attribute: 'show-tile' }) showTile: boolean = false;

  @Prop({ attribute: 'title-text' }) titleText?: string;

  @Prop({ attribute: 'show-meta' }) showMeta: boolean = false;

  @Prop({ attribute: 'subtitle-text' }) subtitleText?: string;

  // optional icon  --> reserved for future use (safe default = unused)
  @Prop({ attribute: 'icon-src' }) iconSrc?: string;

  // single-item mode (backwards compatible)
  @Prop() question?: string;

  @Prop() answer?: string;

  // ---------- internal state ----------

  @State() groups: CategoryGroup[] = [];

  @State() totalFaqs: number = 0;

  @State() expandedById: Record<string, boolean> = {};

  @State() isLoading: boolean = false;

  @State() errorText: string | null = null;

  // ---------- lifecycle ----------

  async componentWillLoad() {
    if (this.dataMode !== 'faqs') return;

    this.isLoading = true;

    this.errorText = null;

    try {
      const { groups, totalCount } = await this.fetchAndGroupFaqs();

      this.groups = groups;

      this.totalFaqs = totalCount;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      console.warn('[aon-faq-card] faqs load failed:', msg);

      this.errorText = msg;

      this.groups = [];

      this.totalFaqs = 0;
    } finally {
      this.isLoading = false;
    }
  }

  // ---------- data ----------

  private getFetchFirst(): number {
    const n = Number(this.fetchFirst);

    if (!Number.isFinite(n) || n <= 0) return 25;

    return Math.floor(n);
  }

  private async fetchAndGroupFaqs(): Promise<{
    groups: CategoryGroup[];
    totalCount: number;
  }> {
    const first = this.getFetchFirst();

    const res = await fetch('/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: FAQS_CONNECTION_QUERY,
        variables: { first, after: null, category: null, search: null }
      })
    });

    if (!res.ok) throw new Error(`NETWORK_ERROR: http ${res.status}`);

    const json = (await res.json()) as FaqsConnectionResponse;

    if (json.errors && json.errors.length) {
      const msg = json.errors
        .map(e => e.message ?? 'unknown graphql error')
        .join(' | ');

      throw new Error(`GRAPHQL_ERROR: ${msg}`);
    }

    const nodes =
      json.data?.faqsConnection?.edges
        ?.map(e => e.node)
        ?.filter((n): n is FaqNode =>
          Boolean(n && n.id && n.question && n.category)
        ) ?? [];

    const totalCount =
      Number(json.data?.faqsConnection?.totalCount ?? nodes.length) ||
      nodes.length;

    const map = new Map<
      string,
      Array<{ id: string; question: string; answer: string }>
    >();

    for (const n of nodes) {
      const cat = (n.category || 'General').trim() || 'General';

      const list = map.get(cat) ?? [];

      list.push({
        id: n.id,
        question: (n.question || '').trim(),
        answer: (n.answer || '').trim()
      });

      map.set(cat, list);
    }

    const groups: CategoryGroup[] = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([title, items]) => ({
        title,
        items: items.sort((a, b) => a.question.localeCompare(b.question))
      }));

    return { groups, totalCount };
  }

  // ---------- ui helpers ----------

  private isExpanded(id: string): boolean {
    return Boolean(this.expandedById[id]);
  }

  private toggleExpanded(id: string) {
    this.expandedById = { ...this.expandedById, [id]: !this.isExpanded(id) };
  }

  private renderTileHeader() {
    if (!this.showTile) return null;

    const title = (this.titleText ?? '').trim();

    const subtitle = (this.subtitleText ?? '').trim();

    const categoriesCount = this.groups.length;

    const metaText = `${this.totalFaqs} faqs ${categoriesCount} categories`;

    return (
      <header class="tileHeader">
        <div class="tileText">
          {title.length > 0 && <h2 class="tileTitle">{title}</h2>}

          {this.showMeta && <div class="tileMeta">{metaText}</div>}

          {subtitle.length > 0 && <div class="tileSubtitle">{subtitle}</div>}
        </div>
      </header>
    );
  }

  private renderToggle(expanded: boolean) {
    return (
      <span
        class={{ aonToggleIcon: true, isOpen: expanded }}
        aria-hidden="true"
      >
        <span class="aonToggleBarH" />
        <span class="aonToggleBarV" />
      </span>
    );
  }

  private renderStateText(text: string) {
    return <div class="stateText">{text}</div>;
  }

  private renderFaqRow(item: { id: string; question: string; answer: string }) {
    const expanded = this.isExpanded(item.id);

    const hasAnswer = (item.answer ?? '').trim().length > 0;

    return (
      <li class="row" key={item.id}>
        <button
          class="rowHeader"
          type="button"
          aria-expanded={expanded}
          onClick={() => this.toggleExpanded(item.id)}
        >
          <div class="rowQuestion">{item.question}</div>

          <div class="rowToggle">{this.renderToggle(expanded)}</div>
        </button>

        {hasAnswer && (
          <div
            class={{ aonRevealWrap: true, isOpen: expanded }}
            aria-hidden={!expanded}
          >
            <div class="aonRevealInner">{item.answer}</div>
          </div>
        )}
      </li>
    );
  }

  private renderCategoryCard(group: CategoryGroup) {
    return (
      <section class="card" key={group.title}>
        <header class="cardHeaderStatic">
          <h3 class="cardTitle">{group.title}</h3>
        </header>

        <ul class="rows" role="list">
          {group.items.map(it => this.renderFaqRow(it))}
        </ul>
      </section>
    );
  }

  private renderSingle() {
    const q = (this.question ?? '').trim();

    const a = (this.answer ?? '').trim();

    const expanded = this.isExpanded('__single__');

    if (q.length === 0) return null;

    return (
      <section class="card">
        <ul class="rows" role="list">
          <li class="row">
            <button
              class="rowHeader"
              type="button"
              aria-expanded={expanded}
              onClick={() => this.toggleExpanded('__single__')}
            >
              <div class="rowQuestion">{q}</div>

              <div class="rowToggle">{this.renderToggle(expanded)}</div>
            </button>

            {a.length > 0 && (
              <div
                class={{ aonRevealWrap: true, isOpen: expanded }}
                aria-hidden={!expanded}
              >
                <div class="aonRevealInner">{a}</div>
              </div>
            )}
          </li>
        </ul>
      </section>
    );
  }

  // ---------- render ----------

  render() {
    if (this.dataMode === 'faqs') {
      const hasError = Boolean(this.errorText);

      const hasGroups = this.groups.length > 0;

      const isEmpty = !this.isLoading && !hasError && !hasGroups;

      return (
        <div class="wrap">
          {this.renderTileHeader()}

          {this.isLoading && this.renderStateText('loading faqs...')}

          {!this.isLoading &&
            hasError &&
            this.renderStateText(`error: ${this.errorText}`)}

          {isEmpty && this.renderStateText('no faqs found')}

          {hasGroups && (
            <div class="grid">
              {this.groups.map(g => this.renderCategoryCard(g))}
            </div>
          )}
        </div>
      );
    }

    if (this.dataMode === 'single') {
      return <div class="wrap">{this.renderSingle()}</div>;
    }

    return null;
  }
}
