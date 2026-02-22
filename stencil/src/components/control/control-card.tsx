/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  --> grouped controls as expandable cards (aon-style)

  - react owns fetching/caching and passes controls-json + loading/error props
  - stencil owns parsing/grouping/rendering + per-category expand state
  - optional tile header derives meta from parsed controls connection data
  - no stencil network requests (pure prop-driven ui component)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { Component, Prop, State, Watch, h } from '@stencil/core';
import type {
  Control,
  ControlGroup,
  ControlsConnection
} from '../../../../types-shared';

// ---------- local helpers ----------

type ParsedControlsResult = {
  groups: ControlGroup[];
  totalCount: number;
};

@Component({
  tag: 'aon-control-card',
  styleUrl: 'control-card.css',
  shadow: true
})
export class ControlCard {
  // ---------- public api (attributes) ----------

  @Prop() dataMode: 'controls' | 'none' = 'none'; // explicit mode gate so callers can disable rendering
  @Prop() showTile: boolean = false; // optional title/meta header above the grid
  @Prop() titleText?: string; // tile title text
  @Prop() showMeta: boolean = false; // tile meta toggle (counts)
  @Prop() subtitleText?: string; // tile subtitle / helper copy
  @Prop() iconSrc?: string; // optional status icon image for right column
  @Prop() controlsJson: string = ''; // react -> stencil serialized ControlsConnection
  @Prop() isLoading: boolean = false; // react-controlled loading state
  @Prop() errorText: string = ''; // react-controlled error state (api/network layer)
  @Prop() sectionIdPrefix: string = 'controls-category'; // fragment id prefix used by api-driven subnav links

  // ---------- internal state ----------

  @State() groups: ControlGroup[] = []; // grouped + sorted data derived from controls-json
  @State() totalControls: number = 0; // derived count used in tile meta
  @State() expandedByKey: Record<string, boolean> = {}; // per-category open/closed ui state
  @State() parseErrorText: string = ''; // local parse/shape validation error (json -> ui state)

  // ---------- lifecycle ----------

  componentWillLoad() {
    this.bootstrapFromProps(); // initialize internal state from incoming props
  }

  // ---------- watchers ----------

  @Watch('controlsJson')
  onControlsJsonChange() {
    // re-parse only when controls payload changes
    if (this.dataMode !== 'controls') return;

    this.syncControlsFromJson(this.controlsJson);
  }

  @Watch('dataMode')
  onDataModeChange() {
    // mode changes can require a full reset or parse
    this.bootstrapFromProps();
  }

  // ---------- state reset helpers ----------

  private resetParsedControlsState() {
    // keep ui expansion state untouched on successful refetches unless caller changes categories
    // but clear all parsed payload state when mode/data is absent
    this.groups = [];
    this.totalControls = 0;
    this.parseErrorText = '';
  }

  // ---------- id helpers ----------

  private toSlug(value: string): string {
    return (value ?? '')
      .toLowerCase()
      .trim()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private getCategorySectionId(categoryTitle: string): string {
    const prefix = (this.sectionIdPrefix ?? '').trim();
    const slug = this.toSlug(categoryTitle);

    // fall back to slug-only if no prefix was passed
    if (!prefix) return slug;

    return slug ? `${prefix}-${slug}` : prefix;
  }

  // ---------- data (react-fed json -> grouped stencil ui state) ----------

  private bootstrapFromProps() {
    // non-controls mode should fully clear derived controls data
    if (this.dataMode !== 'controls') {
      this.resetParsedControlsState();
      return;
    }

    // controls mode parses current payload
    this.syncControlsFromJson(this.controlsJson);
  }

  private syncControlsFromJson(raw: string) {
    const text = (raw ?? '').trim(); // normalize null/undefined/whitespace payloads

    // empty payload is not a parse error --> it represents "no data yet" or "no results"
    if (!text) {
      this.resetParsedControlsState();
      return;
    }

    try {
      const parsed = this.parseControlsConnection(text);

      this.groups = parsed.groups;

      this.totalControls = parsed.totalCount;

      this.parseErrorText = '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      console.warn('[aon-control-card] controls-json parse failed:', msg);

      this.groups = [];

      this.totalControls = 0;

      this.parseErrorText = `INVALID_CONTROLS_JSON: ${msg}`;
    }
  }

  private parseControlsConnection(text: string): ParsedControlsResult {
    const parsed = JSON.parse(text) as ControlsConnection; // caller passes serialized graphql connection shape

    const edges = Array.isArray(parsed?.edges) ? parsed.edges : []; // tolerate malformed/missing edges

    const nodes = edges
      .map(edge => edge?.node) // pull node payloads from edges
      .filter((node): node is Control =>
        Boolean(node && node.id && node.title && node.category)
      ); // keep only minimal valid controls needed by this ui

    const groups = this.groupByCategory(nodes); // derive grouped ui structure

    const totalCount =
      Number(parsed?.totalCount ?? nodes.length) || nodes.length; // prefer server totalCount, fallback to node count

    return { groups, totalCount };
  }

  private groupByCategory(nodes: Control[]): ControlGroup[] {
    const map = new Map<string, ControlGroup['items']>(); // category -> row items

    for (const node of nodes) {
      const title = (node.title || '').trim(); // normalize display title

      if (!title) continue; // skip empty labels so rows stay clean

      const category = (node.category || 'General').trim() || 'General'; // safe category fallback

      const list = map.get(category) ?? []; // existing bucket or new bucket

      list.push({
        id: node.id,
        title,
        description: (node.description || '').trim()
      });

      map.set(category, list);
    }

    const groups: ControlGroup[] = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0])) // stable alphabetical categories
      .map(([title, items]) => ({
        title,
        items: [...items].sort((a, b) => a.title.localeCompare(b.title)) // stable alphabetical controls
      }));

    return groups;
  }

  private getDisplayErrorText(): string {
    // api/network error from react layer wins over local parse error
    const externalError = (this.errorText ?? '').trim();

    if (externalError.length > 0) return externalError;

    return (this.parseErrorText ?? '').trim();
  }

  // ---------- ui helpers ----------

  private isExpanded(key: string): boolean {
    return Boolean(this.expandedByKey[key]); // missing keys are closed by default
  }

  private toggleExpanded(key: string) {
    // immutable update so stencil change detection sees a new object reference
    this.expandedByKey = {
      ...this.expandedByKey,
      [key]: !this.isExpanded(key)
    };
  }

  private renderToggle(expanded: boolean) {
    // shared aon toggle icon pattern (plus -> minus animation handled in css)
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

  private renderStatusIcon() {
    // fallback dot keeps column layout stable if no icon is supplied
    if (!this.iconSrc) return <span class="status-dot" aria-hidden="true" />;

    return (
      <img
        class="status-icon"
        src={this.iconSrc}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
      />
    );
  }

  private renderTileHeader() {
    if (!this.showTile) return null; // caller opted out of tile header

    const title = (this.titleText ?? '').trim(); // normalize optional strings

    const subtitle = (this.subtitleText ?? '').trim();

    const categoriesCount = this.groups.length; // derived from grouped ui data

    const metaText = `${this.totalControls} controls ${categoriesCount} categories`;

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

  private renderCategoryCard(group: ControlGroup) {
    const key = group.title; // category title acts as expand-state key

    const expanded = this.isExpanded(key); // current category state

    return (
      <section
        class="card"
        key={group.title}
        id={this.getCategorySectionId(group.title)} // subnav anchors land here
        role="table"
        aria-label={`${group.title} controls`}
      >
        <button
          class="card-header"
          type="button"
          aria-expanded={expanded}
          onClick={() => this.toggleExpanded(key)}
        >
          <div class="card-header-left">
            <h3 class="card-title">{group.title}</h3>
          </div>

          <div class="card-header-right">{this.renderToggle(expanded)}</div>
        </button>

        <div class="columns" role="row">
          <div class="col-left" role="columnheader">
            Control
          </div>

          <div class="col-right" role="columnheader">
            Status
          </div>
        </div>

        <ul class="rows" role="rowgroup">
          {group.items.map(c => {
            const hasDesc = (c.description ?? '').trim().length > 0; // reveal body is optional per row

            return (
              <li class="row" key={c.id} role="row">
                <div class="row-left" role="cell">
                  <div class="row-title">{c.title}</div>

                  {hasDesc && (
                    <div
                      class={`aon-reveal-wrap${expanded ? ' is-open' : ''}`}
                      aria-hidden={!expanded}
                    >
                      <div class="aon-reveal-inner">{c.description}</div>
                    </div>
                  )}
                </div>

                <div class="row-right" role="cell">
                  {this.renderStatusIcon()}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  private renderStatusMessage() {
    const finalErrorText = this.getDisplayErrorText(); // react error or local parse error

    // error state has highest priority so users do not miss failures
    if (finalErrorText.length > 0) {
      return (
        <div role="alert" aria-live="assertive">
          {finalErrorText}
        </div>
      );
    }

    // show loading text only when there is no renderable data yet
    if (this.isLoading && this.groups.length === 0) {
      return (
        <div role="status" aria-live="polite">
          Loading controls...
        </div>
      );
    }

    // empty state after loading completes (or empty payload provided)
    if (this.groups.length === 0) {
      return (
        <div role="status" aria-live="polite">
          No controls available.
        </div>
      );
    }

    return null; // caller can render the grid
  }

  // ---------- render ----------

  render() {
    const statusMessage = this.renderStatusMessage(); // compute once for render branch clarity

    return (
      <div class="wrap">
        {this.renderTileHeader()}

        {statusMessage ?? (
          <div class="grid">
            {this.groups.map(g => this.renderCategoryCard(g))}
          </div>
        )}
      </div>
    );
  }
}
