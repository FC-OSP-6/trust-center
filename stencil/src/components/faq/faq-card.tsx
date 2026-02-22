/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  --> FAQ cards (prop-driven)

  - no stencil fetch calls (react/api owns querying + caching)
  - react passes faqs-json + loading/error props
  - stencil owns parsing/grouping + expand/collapse + rendering
  - supports grouped faqs mode and single faq mode
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { Component, Prop, State, Watch, h } from '@stencil/core';
import type { Faq, FaqGroup, FaqsConnection } from '../../../../types-shared';

// ---------- local helpers ----------

type FaqRowItem = {
  id: string;
  question: string;
  answer: string;
};

@Component({
  tag: 'aon-faq-card',
  styleUrl: 'faq-card.css',
  shadow: true
})
export class FaqCard {
  /* ---------- public api ---------- */

  @Prop() dataMode: 'faqs' | 'single' | 'none' = 'none'; // grouped faqs, one faq, or hidden

  @Prop() showTile: boolean = false; // optional tile header for grouped faq mode

  @Prop() titleText?: string; // tile title

  @Prop() showMeta: boolean = false; // tile meta toggle (faq/category counts)

  @Prop() subtitleText?: string; // tile subtitle

  @Prop() iconSrc?: string; // reserved for api parity / future visual variants (unused currently)

  /* single-item mode */
  @Prop() question?: string; // single faq question text

  @Prop() answer?: string; // single faq answer text

  /* react -> stencil data pipe */
  @Prop() faqsJson: string = ''; // serialized FaqsConnection from react/api layer

  @Prop() isLoading: boolean = false; // react-controlled loading flag

  @Prop() errorText: string = ''; // react-controlled error text (api/network layer)

  /* ---------- internal state ---------- */

  @State() groups: FaqGroup[] = []; // grouped + sorted faq categories for faqs mode

  @State() totalFaqs: number = 0; // count used for tile meta text

  @State() expandedById: Record<string, boolean> = {}; // per-row expand/collapse state (plus single mode key)

  @State() parseErrorText: string = ''; // local parse error when faqs-json is malformed

  /* ---------- lifecycle ---------- */

  componentWillLoad() {
    this.bootstrapFromProps(); // initialize internal state from incoming props
  }

  /* ---------- watchers ---------- */

  @Watch('faqsJson')
  onFaqsJsonChange() {
    // only re-parse faqs-json when the component is in grouped faqs mode
    if (this.dataMode !== 'faqs') return;

    this.syncFaqsFromJson(this.faqsJson);
  }

  @Watch('dataMode')
  onDataModeChange() {
    // mode changes can require a parse or a full reset
    this.bootstrapFromProps();
  }

  /* ---------- reset helpers ---------- */

  private resetParsedFaqState() {
    // clears only data derived from faqs-json
    // expand state is intentionally preserved so toggles survive re-parses when ids match
    this.groups = [];
    this.totalFaqs = 0;
    this.parseErrorText = '';
  }

  /* ---------- parse + group ---------- */

  private bootstrapFromProps() {
    // grouped faqs mode parses json payload from react
    if (this.dataMode === 'faqs') {
      this.syncFaqsFromJson(this.faqsJson);
      return;
    }

    // single/none mode should not carry grouped faq data state
    this.resetParsedFaqState();
  }

  private syncFaqsFromJson(raw: string) {
    const text = (raw ?? '').trim(); // normalize null/undefined/whitespace payloads

    // empty payload is a valid "nothing yet / no results" state
    if (!text) {
      this.resetParsedFaqState();
      return;
    }

    try {
      const parsed = this.parseFaqsConnection(text);

      this.groups = parsed.groups;

      this.totalFaqs = parsed.totalFaqs;

      this.parseErrorText = '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      console.warn('[aon-faq-card] faqs-json parse failed:', msg);

      this.groups = [];
      this.totalFaqs = 0;
      this.parseErrorText = `INVALID_FAQS_JSON: ${msg}`;
    }
  }

  private parseFaqsConnection(text: string): {
    groups: FaqGroup[];
    totalFaqs: number;
  } {
    const parsed = JSON.parse(text) as FaqsConnection; // caller passes serialized graphql connection shape

    const edges = Array.isArray(parsed?.edges) ? parsed.edges : []; // tolerate missing/malformed edges

    const nodes = edges
      .map(edge => edge?.node) // unwrap graphql edges -> nodes
      .filter((node): node is Faq =>
        Boolean(node && node.id && node.question && node.category)
      ); // keep only minimal fields required by this ui

    const groups = this.groupByCategory(nodes); // derive grouped ui structure

    const totalFaqs =
      Number(parsed?.totalCount ?? nodes.length) || nodes.length; // prefer server count, fallback to parsed nodes

    return { groups, totalFaqs };
  }

  private groupByCategory(nodes: Faq[]): FaqGroup[] {
    const map = new Map<string, FaqRowItem[]>(); // category -> faq rows

    for (const node of nodes) {
      const category = (node.category || 'General').trim() || 'General'; // safe fallback category

      const question = (node.question || '').trim(); // normalize strings before sorting/rendering

      const answer = (node.answer || '').trim();

      if (!question) continue; // defensive skip (filter above already checks truthy, but trim may empty it)

      const list = map.get(category) ?? [];

      list.push({
        id: node.id,
        question,
        answer
      });

      map.set(category, list);
    }

    const groups: FaqGroup[] = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0])) // stable alphabetical category order
      .map(([title, items]) => ({
        title,
        items: [...items].sort((a, b) => a.question.localeCompare(b.question)) // stable alphabetical question order
      }));

    return groups;
  }

  private getDisplayErrorText(): string {
    // api/network error from react layer wins over local parse error
    const externalError = (this.errorText ?? '').trim();

    if (externalError.length > 0) return externalError;

    return (this.parseErrorText ?? '').trim();
  }

  /* ---------- ui helpers ---------- */

  private isExpanded(id: string): boolean {
    return Boolean(this.expandedById[id]); // missing keys default to collapsed
  }

  private toggleExpanded(id: string) {
    // immutable object update for stencil state change detection
    this.expandedById = {
      ...this.expandedById,
      [id]: !this.isExpanded(id)
    };
  }

  private renderTileHeader() {
    if (!this.showTile) return null; // caller opted out of tile header

    const title = (this.titleText ?? '').trim(); // normalize optional strings

    const subtitle = (this.subtitleText ?? '').trim();

    const categoriesCount = this.groups.length; // derived from grouped data

    const metaText = `${this.totalFaqs} faqs ${categoriesCount} categories`;

    // avoid rendering an empty header wrapper
    if (title.length === 0 && subtitle.length === 0 && !this.showMeta)
      return null;

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
    // use the same class naming + binding pattern as control/expansion components
    return (
      <span
        class={`aon-toggle-icon${expanded ? ' is-open' : ''}`}
        aria-hidden="true"
      >
        <span class="aon-toggle-bar-h" />
        <span class="aon-toggle-bar-v" />
      </span>
    );
  }

  private renderStateText(text: string, mode: 'status' | 'alert' = 'status') {
    // small helper keeps grouped faq render branch readable
    if (mode === 'alert') {
      return (
        <div class="state-text" role="alert" aria-live="assertive">
          {text}
        </div>
      );
    }

    return (
      <div class="state-text" role="status" aria-live="polite">
        {text}
      </div>
    );
  }

  private renderFaqRow(item: FaqRowItem) {
    const expanded = this.isExpanded(item.id); // row-local expand state

    const hasAnswer = (item.answer ?? '').trim().length > 0; // answer body can be absent

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
            class={`aon-reveal-wrap${expanded ? ' is-open' : ''}`}
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
    const q = (this.question ?? '').trim(); // normalize optional single mode content

    const a = (this.answer ?? '').trim();

    const expanded = this.isExpanded('__single__'); // reserved key for single mode faq

    if (q.length === 0) return null; // no question --> nothing to render

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
                class={`aon-reveal-wrap${expanded ? ' is-open' : ''}`}
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
      const finalErrorText = this.getDisplayErrorText(); // api error or local parse error

      const hasError = finalErrorText.length > 0; // error state should suppress empty-state messaging

      const hasGroups = this.groups.length > 0; // grouped data exists and can render

      const showLoadingMessage = this.isLoading && !hasGroups && !hasError; // avoid replacing visible data during background refresh

      const isEmpty = !this.isLoading && !hasError && !hasGroups; // only true after loading settles and no data exists

      return (
        <div class="wrap">
          {this.renderTileHeader()}

          {showLoadingMessage && this.renderStateText('loading faqs...')}

          {!this.isLoading &&
            hasError &&
            this.renderStateText(`error: ${finalErrorText}`, 'alert')}

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

    return null; // explicit none mode
  }
}
