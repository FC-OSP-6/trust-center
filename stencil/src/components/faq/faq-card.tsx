/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  --> FAQ cards (prop-driven)

  - no stencil fetch calls
  - react passes faqs-json + loading/error props
  - stencil owns grouping + expand/collapse + rendering
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { Component, Prop, State, Watch, h } from '@stencil/core';
import type { Faq, FaqGroup, FaqsConnection } from '../../../../types-shared';

@Component({
  tag: 'aon-faq-card',
  styleUrl: 'faq-card.css',
  shadow: true
})
export class FaqCard {
  /* ---------- public api ---------- */

  @Prop() dataMode: 'faqs' | 'single' | 'none' = 'none';

  @Prop() showTile: boolean = false;

  @Prop() titleText?: string;

  @Prop() showMeta: boolean = false;

  @Prop() subtitleText?: string;

  @Prop() iconSrc?: string;

  /* single-item mode */
  @Prop() question?: string;

  @Prop() answer?: string;

  /* react -> stencil data pipe */
  @Prop() faqsJson: string = '';

  @Prop() isLoading: boolean = false;

  @Prop() errorText: string = '';

  /* ---------- internal state ---------- */

  @State() groups: FaqGroup[] = [];

  @State() totalFaqs: number = 0;

  @State() expandedById: Record<string, boolean> = {};

  @State() parseErrorText: string = '';

  /* ---------- lifecycle ---------- */

  componentWillLoad() {
    this.bootstrapFromProps();
  }

  /* ---------- watchers ---------- */

  @Watch('faqsJson')
  onFaqsJsonChange() {
    if (this.dataMode !== 'faqs') return;
    this.bootstrapFromProps();
  }

  @Watch('dataMode')
  onDataModeChange() {
    this.bootstrapFromProps();
  }

  /* ---------- parse + group ---------- */

  private bootstrapFromProps() {
    if (this.dataMode !== 'faqs') {
      this.groups = [];
      this.totalFaqs = 0;
      this.parseErrorText = '';
      return;
    }

    const raw = (this.faqsJson ?? '').trim();

    if (!raw) {
      this.groups = [];
      this.totalFaqs = 0;
      this.parseErrorText = '';
      return;
    }

    try {
      const parsed = JSON.parse(raw) as FaqsConnection;

      const edges = Array.isArray(parsed?.edges) ? parsed.edges : [];

      const nodes = edges
        .map(edge => edge?.node)
        .filter((node): node is Faq =>
          Boolean(node && node.id && node.question && node.category)
        );

      const map = new Map<
        string,
        Array<{ id: string; question: string; answer: string }>
      >();

      for (const node of nodes) {
        const category = (node.category || 'General').trim() || 'General';

        const list = map.get(category) ?? [];

        list.push({
          id: node.id,
          question: (node.question || '').trim(),
          answer: (node.answer || '').trim()
        });

        map.set(category, list);
      }

      const groups: FaqGroup[] = Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([title, items]) => ({
          title,
          items: items.sort((a, b) => a.question.localeCompare(b.question))
        }));

      this.groups = groups;
      this.totalFaqs =
        Number(parsed?.totalCount ?? nodes.length) || nodes.length;
      this.parseErrorText = '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      console.warn('[aon-faq-card] faqs-json parse failed:', msg);

      this.groups = [];
      this.totalFaqs = 0;
      this.parseErrorText = `INVALID_FAQS_JSON: ${msg}`;
    }
  }

  /* ---------- ui helpers ---------- */

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
      <header class="tile-header">
        <div class="tile-text">
          {title.length > 0 && <h2 class="tile-title">{title}</h2>}

          {this.showMeta && <div class="tile-meta">{metaText}</div>}

          {subtitle.length > 0 && <div class="tile-subtitle">{subtitle}</div>}
        </div>
      </header>
    );
  }

  private renderToggle(expanded: boolean) {
    return (
      <span
        class={{ 'aon-toggle-icon': true, 'is-open': expanded }}
        aria-hidden="true"
      >
        <span class="aon-toggle-bar-H" />
        <span class="aon-toggle-bar-V" />
      </span>
    );
  }

  private renderStateText(text: string) {
    return <div class="state-text">{text}</div>;
  }

  private renderFaqRow(item: { id: string; question: string; answer: string }) {
    const expanded = this.isExpanded(item.id);

    const hasAnswer = (item.answer ?? '').trim().length > 0;

    return (
      <li class="row" key={item.id}>
        <button
          class="row-header"
          type="button"
          aria-expanded={expanded}
          onClick={() => this.toggleExpanded(item.id)}
        >
          <div class="row-question">{item.question}</div>
          <div class="row-toggle">{this.renderToggle(expanded)}</div>
        </button>

        {hasAnswer && (
          <div
            class={{ 'aon-reveal-wrap': true, 'is-open': expanded }}
            aria-hidden={!expanded}
          >
            <div class="aon-reveal-inner">{item.answer}</div>
          </div>
        )}
      </li>
    );
  }

  private renderCategoryCard(group: FaqGroup) {
    return (
      <section class="card" key={group.title}>
        <header class="card-header-static">
          <h3 class="card-title">{group.title}</h3>
        </header>

        <ul class="rows" role="list">
          {group.items.map(item => this.renderFaqRow(item))}
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
              class="row-header"
              type="button"
              aria-expanded={expanded}
              onClick={() => this.toggleExpanded('__single__')}
            >
              <div class="row-question">{q}</div>
              <div class="row-toggle">{this.renderToggle(expanded)}</div>
            </button>

            {a.length > 0 && (
              <div
                class={{ 'aon-reveal-wrap': true, 'is-open': expanded }}
                aria-hidden={!expanded}
              >
                <div class="aon-reveal-inner">{a}</div>
              </div>
            )}
          </li>
        </ul>
      </section>
    );
  }

  /* ---------- render ---------- */

  render() {
    if (this.dataMode === 'faqs') {
      const finalErrorText = (
        this.errorText ||
        this.parseErrorText ||
        ''
      ).trim();

      const hasError = finalErrorText.length > 0;

      const hasGroups = this.groups.length > 0;

      const isEmpty = !this.isLoading && !hasError && !hasGroups;

      return (
        <div class="wrap">
          {this.renderTileHeader()}

          {this.isLoading && this.renderStateText('loading faqs...')}

          {!this.isLoading &&
            hasError &&
            this.renderStateText(`error: ${finalErrorText}`)}

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
