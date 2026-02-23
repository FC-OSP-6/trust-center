/* ======================================================
  TL;DR  --> expandable bullet list card + controls overview mode (prop-driven)

  static mode:
  - renders a single titled card
  - accepts bullet-points-json (string[])

  controls mode:
  - no network requests in stencil
  - react passes controls-json + loading/error props
  - stencil groups controls by category + renders view-all behavior
====================================================== */

import { Component, Prop, State, Watch, h } from '@stencil/core';
import type {
  Control,
  ControlsConnection,
  ExpansionControlGroup
} from '../../../../types-shared';

// ---------- local helpers ----------

type ParsedExpansionControlsResult = {
  groupedCategories: ExpansionControlGroup[];
  totalControls: number;
};

@Component({
  tag: 'aon-expansion-card',
  styleUrl: 'expansion-card.css',
  shadow: true
})
export class ExpansionCard {
  /* ---------- public api (shared) ---------- */

  @Prop() dataMode: 'static' | 'controls' = 'static'; // switches component behavior + payload parsing path

  @Prop() iconSrc?: string; // optional icon shown next to each bullet/title row

  @Prop() previewLimit: number = 3; // max visible items before "view all" in each list

  @Prop() isLoading: boolean = false; // react-controlled loading state (controls mode)

  @Prop() errorText: string = ''; // react-controlled error text (controls mode)

  /* ---------- static mode props ---------- */

  @Prop() cardTitle: string = ''; // static card heading

  @Prop() bulletPointsJson: string = '[]'; // serialized string[] for static mode

  /* ---------- controls mode props ---------- */

  @Prop() controlsJson: string = ''; // serialized ControlsConnection passed by react/api

  @Prop() categoryLimit: number = 3; // max visible categories on overview before limiting

  @Prop() showTile: boolean = false; // optional controls-mode tile header

  @Prop() tileTitle: string = ''; // controls-mode tile title

  @Prop() showMeta: boolean = false; // controls-mode tile meta toggle

  @Prop() tileSubtitle: string = ''; // controls-mode tile subtitle/helper copy

  /* ---------- internal state (static mode) ---------- */

  @State() isExpanded: boolean = false; // static-mode card expand/collapse

  @State() bulletPoints: string[] = []; // parsed static-mode bullet items

  /* ---------- internal state (controls mode) ---------- */

  @State() groupedCategories: ExpansionControlGroup[] = []; // grouped + sorted controls for overview rendering

  @State() totalControls: number = 0; // controls count for tile meta text

  @State() expandedByCategory: Record<string, boolean> = {}; // per-category view-all state in controls mode

  @State() parseErrorText: string = ''; // local parse error for malformed controls-json

  /* ---------- lifecycle ---------- */

  componentWillLoad() {
    this.bootstrap(); // initialize whichever mode is currently active
  }

  /* ---------- watchers ---------- */

  @Watch('bulletPointsJson')
  onBulletPointsJsonChange(next: string) {
    // only parse static payload when in static mode
    if (this.dataMode !== 'static') return;

    this.syncBulletPoints(next);
  }

  @Watch('controlsJson')
  onControlsJsonChange() {
    // only parse controls payload when in controls mode
    if (this.dataMode !== 'controls') return;

    this.syncControlsFromJson(this.controlsJson);
  }

  @Watch('dataMode')
  onDataModeChange() {
    // mode changes can require resets + a different parse path
    this.bootstrap();
  }

  /* ---------- bootstrap ---------- */

  private bootstrap() {
    if (this.dataMode === 'controls') {
      // clear static-only parsed state noise when switching modes
      this.bulletPoints = [];

      this.syncControlsFromJson(this.controlsJson);
      return;
    }

    // static mode should not carry stale controls parse errors/counts into future renders
    this.resetControlsParsedState();

    this.syncBulletPoints(this.bulletPointsJson);
  }

  /* ---------- shared numeric helpers ---------- */

  private toSafeInt(value: unknown, fallback: number): number {
    const n = Number(value); // tolerate string numeric attrs passed through custom elements

    if (!Number.isFinite(n)) return fallback; // non-numeric/NaN -> fallback
    if (n <= 0) return fallback; // disallow zero/negative limits

    return Math.floor(n); // ensure integral list limits
  }

  private getPreviewLimit(): number {
    return this.toSafeInt(this.previewLimit, 3);
  }

  private getCategoryLimit(): number {
    return this.toSafeInt(this.categoryLimit, 3);
  }

  /* ---------- static mode parsing ---------- */

  private syncBulletPoints(raw: string) {
    // parse and normalize incoming static bullet list json
    this.bulletPoints = this.parseBulletPoints(raw);
  }

  private parseBulletPoints(raw: string): string[] {
    if (!raw) return []; // empty payload -> empty list

    try {
      const parsed = JSON.parse(raw) as unknown; // caller passes stringified array

      if (!Array.isArray(parsed)) return []; // non-array payload -> empty fallback

      return parsed
        .filter(v => typeof v === 'string') // keep only strings
        .map(v => v.trim()) // normalize whitespace
        .filter(v => v.length > 0); // drop empty strings
    } catch {
      return []; // static mode treats bad json as empty list (no user-facing parse error needed)
    }
  }

  /* ---------- controls mode reset + parsing ---------- */

  private resetControlsParsedState() {
    // clears only controls-mode derived data
    this.groupedCategories = [];
    this.totalControls = 0;
    this.parseErrorText = '';
  }

  private syncControlsFromJson(raw: string) {
    const text = (raw ?? '').trim(); // normalize null/undefined/whitespace payloads

    // empty payload is a valid "no data yet / no results" state
    if (!text) {
      this.resetControlsParsedState();
      return;
    }

    try {
      const parsed = this.parseControlsConnection(text);

      this.groupedCategories = parsed.groupedCategories;

      this.totalControls = parsed.totalControls;

      this.parseErrorText = '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      console.warn('[aon-expansion-card] controls-json parse failed:', msg);

      this.groupedCategories = [];
      this.totalControls = 0;
      this.parseErrorText = `INVALID_CONTROLS_JSON: ${msg}`;
    }
  }

  private parseControlsConnection(text: string): ParsedExpansionControlsResult {
    const parsed = JSON.parse(text) as ControlsConnection; // serialized graphql connection from react/api

    const edges = Array.isArray(parsed?.edges) ? parsed.edges : []; // tolerate malformed/missing edges

    const nodes = edges
      .map(edge => edge?.node) // unwrap edges -> nodes
      .filter((node): node is Control =>
        Boolean(node && node.id && node.title && node.category)
      ); // keep only fields needed by this overview ui

    const groupedCategories = this.groupByCategory(nodes); // derive grouped display structure

    const totalControls =
      Number(parsed?.totalCount ?? nodes.length) || nodes.length; // prefer server totalCount, fallback to parsed nodes

    return { groupedCategories, totalControls };
  }

  private groupByCategory(nodes: Control[]): ExpansionControlGroup[] {
    const map = new Map<string, string[]>(); // category -> control titles

    nodes.forEach(node => {
      const category = (node.category || 'General').trim() || 'General'; // safe category fallback
      const title = (node.title || '').trim(); // normalize display title

      if (!title) return; // skip empty rows

      const next = map.get(category) ?? [];

      next.push(title);

      map.set(category, next);
    });

    const groups: ExpansionControlGroup[] = [];

    map.forEach((titles, category) => {
      groups.push({
        category,
        titles: [...titles].sort((a, b) => a.localeCompare(b)) // stable alphabetical order in each category
      });
    });

    groups.sort((a, b) => a.category.localeCompare(b.category)); // stable alphabetical category order

    return groups;
  }

  private getControlsDisplayErrorText(): string {
    // api/network error from react wins over local parse error
    const externalError = (this.errorText ?? '').trim();

    if (externalError.length > 0) return externalError;

    return (this.parseErrorText ?? '').trim();
  }

  /* ---------- ui helpers ---------- */

  private toggleExpanded = () => {
    // static-mode expand/collapse toggle
    this.isExpanded = !this.isExpanded;
  };

  private isCategoryExpanded(category: string): boolean {
    return Boolean(this.expandedByCategory[category]); // missing keys default to collapsed
  }

  private toggleCategoryExpanded = (category: string) => {
    // immutable update so stencil sees a new object reference
    this.expandedByCategory = {
      ...this.expandedByCategory,
      [category]: !this.isCategoryExpanded(category)
    };
  };

  /* ---------- shared row render ---------- */

  private renderBulletRow(text: string) {
    // shared row renderer used in both static mode and controls mode
    return (
      <li class="item" key={text}>
        {this.iconSrc ? (
          <span class="icon-wrap" aria-hidden="true">
            <img
              class="icon-img"
              src={this.iconSrc}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </span>
        ) : (
          <span class="icon-dot" aria-hidden="true" />
        )}

        <span class="text">{text}</span>
      </li>
    );
  }

  /* ---------- static mode render ---------- */

  private renderStaticCard() {
    const title = this.cardTitle || ''; // static header text
    const items = this.bulletPoints; // parsed static items
    const limit = this.getPreviewLimit(); // safe numeric preview limit

    const hasOverflow = items.length > limit; // whether to show view-all button
    const visibleItems = this.isExpanded ? items : items.slice(0, limit); // current visible subset
    const hiddenCount = items.length - visibleItems.length; // used for "+N more" row

    const buttonText = this.isExpanded ? 'View Less' : 'View All';

    if (!title && items.length === 0) return null; // avoid empty wrapper markup

    return (
      <div class="card">
        <header class="header">
          <h3 class="title">{title}</h3>

          {hasOverflow && (
            <button
              class="toggle"
              type="button"
              aria-expanded={this.isExpanded}
              onClick={this.toggleExpanded}
            >
              {buttonText}
            </button>
          )}
        </header>

        <ul class="list" role="list">
          {visibleItems.map(item => this.renderBulletRow(item))}

          {!this.isExpanded && hiddenCount > 0 && (
            <li class="more" aria-hidden="true">
              +{hiddenCount} more
            </li>
          )}
        </ul>
      </div>
    );
  }

  /* ---------- controls mode render ---------- */

  private renderControlsTile() {
    if (!this.showTile) return null; // caller opted out of tile header

    const categoriesCount = this.groupedCategories.length; // derived group count
    const subtitle = (this.tileSubtitle || '').trim(); // normalize optional subtitle
    const title = (this.tileTitle || 'Selected Controls').trim(); // default label for overview section

    // avoid rendering an empty tile wrapper
    if (!title && !subtitle && !this.showMeta) return null;

    return (
      <div class="tile">
        <div class="tile-heading-row">
          {title && <h3 class="tile-title">{title}</h3>}

          {this.showMeta && (
            <div class="tile-meta">
              {this.totalControls} controls&nbsp;&nbsp;{categoriesCount}{' '}
              categories
            </div>
          )}
        </div>

        {subtitle && <div class="tile-subtitle">{subtitle}</div>}
      </div>
    );
  }

  private renderControlsCards() {
    const limitCategories = this.getCategoryLimit(); // safe category limit
    const limitItems = this.getPreviewLimit(); // safe per-category title limit

    const visibleCategories = this.groupedCategories.slice(0, limitCategories); // overview only shows first N categories by design

    const finalErrorText = this.getControlsDisplayErrorText(); // react error or local parse error

    const hasError = finalErrorText.length > 0;

    const hasVisibleCategories = visibleCategories.length > 0;

    // error state wins so users immediately see failures
    if (hasError) {
      return (
        <div class="notice is-error" role="alert" aria-live="assertive">
          Failed to load controls.
          <div class="notice-detail">{finalErrorText}</div>
        </div>
      );
    }

    // show loading only when nothing renderable exists yet
    if (this.isLoading && !hasVisibleCategories) {
      return (
        <div class="notice" role="status" aria-live="polite">
          Loading selected controls…
        </div>
      );
    }

    // empty state after loading completes (or empty payload)
    if (!hasVisibleCategories) {
      return (
        <div class="notice" role="status" aria-live="polite">
          No controls available.
        </div>
      );
    }

    return (
      <div class="group-wrap">
        {visibleCategories.map(group => {
          const isOpen = this.isCategoryExpanded(group.category); // category-local view-all state

          const hasOverflow = group.titles.length > limitItems; // whether this category needs view-all toggle

          const visibleTitles = isOpen
            ? group.titles
            : group.titles.slice(0, limitItems); // current visible rows

          const hiddenCount = group.titles.length - visibleTitles.length; // shown in summary row when collapsed

          const buttonText = isOpen ? 'View Less' : 'View All';

          return (
            <div class="card" key={group.category}>
              <header class="header">
                <h3 class="title">{group.category}</h3>

                {hasOverflow && (
                  <button
                    class="toggle"
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => this.toggleCategoryExpanded(group.category)}
                  >
                    {buttonText}
                  </button>
                )}
              </header>

              <ul class="list" role="list">
                {visibleTitles.map(title => this.renderBulletRow(title))}

                {!isOpen && hiddenCount > 0 && (
                  <li class="more" aria-hidden="true">
                    +{hiddenCount} more
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    );
  }

  /* ---------- render ---------- */

  render() {
    if (this.dataMode === 'controls') {
      return (
        <div class="wrap">
          {this.renderControlsTile()}
          {this.renderControlsCards()}
        </div>
      );
    }

    return <div class="wrap">{this.renderStaticCard()}</div>;
  }
}
