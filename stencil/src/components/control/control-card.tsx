/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  --> grouped controls as expandable cards (aon-style)

  - react owns fetching/caching and passes controls-json + loading/error props
  - stencil owns parsing/grouping/rendering + per-category expand state
  - optional tile header derives meta from parsed controls connection data
  - legacy fetch attrs remain for compatibility while callsites migrate
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

  @Prop() dataMode: 'controls' | 'none' = 'none';

  @Prop() fetchFirst: number = 100; // legacy no-op while react owns fetching

  @Prop() showTile: boolean = false;

  @Prop() titleText?: string;

  @Prop() showMeta: boolean = false;

  @Prop() subtitleText?: string;

  @Prop() iconSrc?: string;

  @Prop() controlsJson: string = '';

  @Prop() isLoading: boolean = false;

  @Prop() errorText: string = '';

  // ---------- internal state ----------

  @State() groups: ControlGroup[] = [];

  @State() totalControls: number = 0;

  @State() expandedByKey: Record<string, boolean> = {};

  @State() parseErrorText: string = '';

  // ---------- lifecycle ----------

  componentWillLoad() {
    this.bootstrapFromProps();
  }

  // ---------- watchers ----------

  @Watch('controlsJson')
  onControlsJsonChange() {
    this.bootstrapFromProps();
  }

  @Watch('dataMode')
  onDataModeChange() {
    this.bootstrapFromProps();
  }

  // ---------- data (react-fed json -> grouped stencil ui state) ----------

  private bootstrapFromProps() {
    if (this.dataMode !== 'controls') {
      this.groups = [];
      this.totalControls = 0;
      this.parseErrorText = '';
      return;
    }

    this.syncControlsFromJson(this.controlsJson);
  }

  private syncControlsFromJson(raw: string) {
    const text = (raw ?? '').trim();

    if (!text) {
      this.groups = [];
      this.totalControls = 0;
      this.parseErrorText = '';
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
    const parsed = JSON.parse(text) as ControlsConnection;

    const edges = Array.isArray(parsed?.edges) ? parsed.edges : [];

    const nodes = edges
      .map(edge => edge?.node)
      .filter((node): node is Control =>
        Boolean(node && node.id && node.title && node.category)
      );

    const groups = this.groupByCategory(nodes);

    const totalCount =
      Number(parsed?.totalCount ?? nodes.length) || nodes.length;

    return { groups, totalCount };
  }

  private groupByCategory(nodes: Control[]): ControlGroup[] {
    const map = new Map<string, ControlGroup['items']>();

    for (const node of nodes) {
      const title = (node.title || '').trim();

      if (!title) continue;

      const category = (node.category || 'General').trim() || 'General';

      const list = map.get(category) ?? [];

      list.push({
        id: node.id,
        title,
        description: (node.description || '').trim()
      });

      map.set(category, list);
    }

    const groups: ControlGroup[] = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([title, items]) => ({
        title,
        items: [...items].sort((a, b) => a.title.localeCompare(b.title))
      }));

    return groups;
  }

  private getDisplayErrorText(): string {
    const externalError = (this.errorText ?? '').trim();

    if (externalError.length > 0) return externalError;

    return (this.parseErrorText ?? '').trim();
  }

  // ---------- ui helpers ----------

  private isExpanded(key: string): boolean {
    return Boolean(this.expandedByKey[key]);
  }

  private toggleExpanded(key: string) {
    this.expandedByKey = {
      ...this.expandedByKey,
      [key]: !this.isExpanded(key)
    };
  }

  private renderToggle(expanded: boolean) {
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
    if (!this.showTile) return null;

    const title = (this.titleText ?? '').trim();

    const subtitle = (this.subtitleText ?? '').trim();

    const categoriesCount = this.groups.length;

    const metaText = `${this.totalControls} controls ${categoriesCount} categories`;

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
    const key = group.title;

    const expanded = this.isExpanded(key);

    return (
      <section
        class="card"
        key={group.title}
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
            const hasDesc = (c.description ?? '').trim().length > 0;

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
    const errorText = this.getDisplayErrorText();

    if (errorText.length > 0) {
      return (
        <div role="alert" aria-live="assertive">
          {errorText}
        </div>
      );
    }

    if (this.isLoading && this.groups.length === 0) {
      return (
        <div role="status" aria-live="polite">
          Loading controls...
        </div>
      );
    }

    if (this.groups.length === 0) {
      return (
        <div role="status" aria-live="polite">
          No controls available.
        </div>
      );
    }

    return null;
  }

  // ---------- render ----------

  render() {
    const statusMessage = this.renderStatusMessage();

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
