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

@Component({
  tag: 'aon-expansion-card',
  styleUrl: 'expansion-card.css',
  shadow: true
})
export class ExpansionCard {
  /* ---------- public api (shared) ---------- */

  @Prop() dataMode: 'static' | 'controls' = 'static';

  @Prop() iconSrc?: string;

  @Prop() previewLimit: number = 3;

  @Prop() isLoading: boolean = false;

  @Prop() errorText: string = '';

  /* ---------- static mode props ---------- */

  @Prop() cardTitle: string = '';

  @Prop() bulletPointsJson: string = '[]';

  /* ---------- controls mode props ---------- */

  @Prop() controlsJson: string = '';

  @Prop() categoryLimit: number = 3;

  @Prop() showTile: boolean = false;

  @Prop() tileTitle: string = '';

  @Prop() showMeta: boolean = false;

  @Prop() tileSubtitle: string = '';

  /* ---------- internal state (static mode) ---------- */

  @State() isExpanded: boolean = false;

  @State() bulletPoints: string[] = [];

  /* ---------- internal state (controls mode) ---------- */

  @State() groupedCategories: ExpansionControlGroup[] = [];

  @State() totalControls: number = 0;

  @State() expandedByCategory: Record<string, boolean> = {};

  @State() parseErrorText: string = '';

  /* ---------- lifecycle ---------- */

  componentWillLoad() {
    this.bootstrap();
  }

  /* ---------- watchers ---------- */

  @Watch('bulletPointsJson')
  onBulletPointsJsonChange(next: string) {
    if (this.dataMode !== 'static') return;
    this.syncBulletPoints(next);
  }

  @Watch('controlsJson')
  onControlsJsonChange() {
    if (this.dataMode !== 'controls') return;
    this.syncControlsFromJson(this.controlsJson);
  }

  @Watch('dataMode')
  onDataModeChange() {
    this.bootstrap();
  }

  /* ---------- bootstrap ---------- */

  private bootstrap() {
    if (this.dataMode === 'controls') {
      this.syncControlsFromJson(this.controlsJson);
      return;
    }

    this.syncBulletPoints(this.bulletPointsJson);
  }

  /* ---------- shared numeric helpers ---------- */

  private toSafeInt(value: unknown, fallback: number): number {
    const n = Number(value);

    if (!Number.isFinite(n)) return fallback;
    if (n <= 0) return fallback;

    return Math.floor(n);
  }

  private getPreviewLimit(): number {
    return this.toSafeInt(this.previewLimit, 3);
  }

  private getCategoryLimit(): number {
    return this.toSafeInt(this.categoryLimit, 3);
  }

  /* ---------- static mode parsing ---------- */

  private syncBulletPoints(raw: string) {
    this.bulletPoints = this.parseBulletPoints(raw);
  }

  private parseBulletPoints(raw: string): string[] {
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw) as unknown;

      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter(v => typeof v === 'string')
        .map(v => v.trim())
        .filter(v => v.length > 0);
    } catch {
      return [];
    }
  }

  /* ---------- controls mode parsing + grouping ---------- */

  private syncControlsFromJson(raw: string) {
    const text = (raw ?? '').trim();

    if (!text) {
      this.groupedCategories = [];
      this.totalControls = 0;
      this.parseErrorText = '';
      return;
    }

    try {
      const parsed = JSON.parse(text) as ControlsConnection;

      const edges = Array.isArray(parsed?.edges) ? parsed.edges : [];

      const nodes = edges
        .map(edge => edge?.node)
        .filter((node): node is Control =>
          Boolean(node && node.id && node.title && node.category)
        );

      this.groupedCategories = this.groupByCategory(nodes);
      this.totalControls =
        Number(parsed?.totalCount ?? nodes.length) || nodes.length;
      this.parseErrorText = '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      console.warn('[aon-expansion-card] controls-json parse failed:', msg);

      this.groupedCategories = [];
      this.totalControls = 0;
      this.parseErrorText = `INVALID_CONTROLS_JSON: ${msg}`;
    }
  }

  private groupByCategory(nodes: Control[]): ExpansionControlGroup[] {
    const map = new Map<string, string[]>();

    nodes.forEach(node => {
      const category = (node.category || 'General').trim() || 'General';
      const title = (node.title || '').trim();

      if (!title) return;

      const next = map.get(category) ?? [];

      next.push(title);

      map.set(category, next);
    });

    const groups: ExpansionControlGroup[] = [];

    map.forEach((titles, category) => {
      groups.push({
        category,
        titles: [...titles].sort((a, b) => a.localeCompare(b))
      });
    });

    groups.sort((a, b) => a.category.localeCompare(b.category));

    return groups;
  }

  /* ---------- ui helpers ---------- */

  private toggleExpanded = () => {
    this.isExpanded = !this.isExpanded;
  };

  private isCategoryExpanded(category: string): boolean {
    return Boolean(this.expandedByCategory[category]);
  }

  private toggleCategoryExpanded = (category: string) => {
    this.expandedByCategory = {
      ...this.expandedByCategory,
      [category]: !this.isCategoryExpanded(category)
    };
  };

  /* ---------- shared row render ---------- */

  private renderBulletRow(text: string) {
    return (
      <li class="item" key={text}>
        {this.iconSrc ? (
          <span class="icon-wrap" aria-hidden="true">
            <img class="icon-img" src={this.iconSrc} alt="" />
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
    const title = this.cardTitle || '';
    const items = this.bulletPoints;
    const limit = this.getPreviewLimit();

    const hasOverflow = items.length > limit;
    const visibleItems = this.isExpanded ? items : items.slice(0, limit);
    const hiddenCount = items.length - visibleItems.length;

    const buttonText = this.isExpanded ? 'View Less' : 'View All';

    if (!title && items.length === 0) return null;

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
    if (!this.showTile) return null;

    const categoriesCount = this.groupedCategories.length;
    const subtitle = (this.tileSubtitle || '').trim();

    return (
      <div class="tile">
        <div class="tile-heading-row">
          <h3 class="tile-title">{this.tileTitle || 'Selected Controls'}</h3>

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
    const limitCategories = this.getCategoryLimit();
    const limitItems = this.getPreviewLimit();

    const visibleCategories = this.groupedCategories.slice(0, limitCategories);

    const finalErrorText = (this.errorText || this.parseErrorText || '').trim();

    if (this.isLoading) {
      return <div class="notice">Loading selected controls…</div>;
    }

    if (finalErrorText) {
      return (
        <div class="notice is-error">
          Failed to load controls.
          <div class="notice-detail">{finalErrorText}</div>
        </div>
      );
    }

    if (!visibleCategories.length) {
      return <div class="notice">No controls available.</div>;
    }

    return (
      <div class="group-wrap">
        {visibleCategories.map(group => {
          const isOpen = this.isCategoryExpanded(group.category);

          const hasOverflow = group.titles.length > limitItems;

          const visibleTitles = isOpen
            ? group.titles
            : group.titles.slice(0, limitItems);

          const hiddenCount = group.titles.length - visibleTitles.length;

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
