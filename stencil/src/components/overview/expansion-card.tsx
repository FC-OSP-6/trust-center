/* ======================================================
  TL;DR  -->  expandable bullet list card + controls overview mode

  static mode:
  - renders a single titled card
  - accepts bullet-points-json (string[])

  controls mode:
  - fetches controls from graphql (/graphql) in the component (react stays dumb)
  - relies on server resolver for db-first + seed-json fallback
  - groups controls by category
  - shows 3 categories by default (category-limit)
  - shows 3 controls per category by default (preview-limit)
  - uses a per-category "view all / view less" toggle (no +/-)
  - shows "+n more" only when collapsed and overflowing
====================================================== */

import { Component, Prop, State, Watch, h } from '@stencil/core';

type ControlsNode = {
  id: string;
  title: string;
  category: string;
};

type ControlsConnectionPage = {
  edges: Array<{ cursor: string; node: ControlsNode }>;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  totalCount: number;
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

@Component({
  tag: 'aon-expansion-card',
  styleUrl: 'expansion-card.css',
  shadow: true
})
export class ExpansionCard {
  // ----------  public api (shared)  ----------

  @Prop({ attribute: 'data-mode' }) dataMode: 'static' | 'controls' = 'static';

  @Prop({ attribute: 'icon-src' }) iconSrc?: string;

  @Prop({ attribute: 'preview-limit' }) previewLimit: number = 3;

  // ----------  static mode props  ----------

  @Prop({ attribute: 'card-title' }) cardTitle: string = '';

  @Prop({ attribute: 'bullet-points-json' }) bulletPointsJson: string = '[]';

  // ----------  controls mode props  ----------

  @Prop({ attribute: 'fetch-first' }) fetchFirst: number = 50;

  @Prop({ attribute: 'category-limit' }) categoryLimit: number = 3;

  @Prop({ attribute: 'show-tile' }) showTile: boolean = false;

  @Prop({ attribute: 'tile-title' }) tileTitle: string = '';

  @Prop({ attribute: 'show-meta' }) showMeta: boolean = false;

  @Prop({ attribute: 'tile-subtitle' }) tileSubtitle: string = '';

  // ----------  internal state (static mode)  ----------

  @State() isExpanded: boolean = false;

  @State() bulletPoints: string[] = [];

  // ----------  internal state (controls mode)  ----------

  @State() isLoading: boolean = false;

  @State() errorMessage: string = '';

  @State() groupedCategories: Array<{ category: string; titles: string[] }> =
    [];

  @State() totalControls: number = 0;

  @State() expandedByCategory: Record<string, boolean> = {};

  // ----------  lifecycle  ----------

  componentWillLoad() {
    this.bootstrap();
  }

  // ----------  watchers  ----------

  @Watch('bulletPointsJson')
  onBulletPointsJsonChange(next: string) {
    if (this.dataMode !== 'static') return;
    this.syncBulletPoints(next);
  }

  @Watch('dataMode')
  onDataModeChange() {
    this.bootstrap();
  }

  @Watch('fetchFirst')
  onFetchFirstChange() {
    if (this.dataMode !== 'controls') return;
    this.fetchAndGroupControls();
  }

  // ----------  bootstrap  ----------

  private bootstrap() {
    if (this.dataMode === 'controls') {
      this.fetchAndGroupControls();
      return;
    }

    this.syncBulletPoints(this.bulletPointsJson);
  }

  // ----------  shared helpers (numbers)  ----------

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

  private getFetchFirst(): number {
    const requested = this.toSafeInt(this.fetchFirst, 50);
    return Math.min(requested, 50);
  }

  // ----------  static mode parsing  ----------

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

  // ----------  controls mode fetch  ----------

  private buildControlsQuery(): string {
    return `
      query ControlsConnection($first: Int!, $after: String) {
        controlsConnection(first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              title
              category
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
          totalCount
        }
      }
    `;
  }

  private async postGraphQL<T>(body: {
    query: string;
    variables: Record<string, unknown>;
  }): Promise<GraphQLResponse<T>> {
    const res = await fetch('/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });

    const json = (await res.json()) as GraphQLResponse<T>;

    return json;
  }

  private toErrorMessage(err: unknown): string {
    if (err instanceof Error && err.message) return err.message;
    return String(err);
  }

  private async fetchAllControls(): Promise<{
    nodes: ControlsNode[];
    totalCount: number;
  }> {
    const first = this.getFetchFirst();
    const query = this.buildControlsQuery();

    let after: string | null = null;
    let safetyPages = 0;

    const nodes: ControlsNode[] = [];
    let totalCount = 0;

    while (safetyPages < 25) {
      const variables = {
        first,
        ...(after ? { after } : {})
      };

      const resp = await this.postGraphQL<{
        controlsConnection: ControlsConnectionPage;
      }>({
        query,
        variables
      });

      if (resp.errors && resp.errors.length) {
        const msg = resp.errors
          .map(e => e.message || 'GraphQL error')
          .join(' | ');
        throw new Error(msg);
      }

      const page = resp.data?.controlsConnection;

      if (!page) {
        throw new Error('GraphQL response missing controlsConnection');
      }

      totalCount = Number(page.totalCount || 0);

      page.edges.forEach(e => {
        if (!e?.node) return;
        nodes.push(e.node);
      });

      if (!page.pageInfo?.hasNextPage) break;
      if (!page.pageInfo?.endCursor) break;

      after = page.pageInfo.endCursor;
      safetyPages += 1;
    }

    return { nodes, totalCount };
  }

  private groupByCategory(
    nodes: ControlsNode[]
  ): Array<{ category: string; titles: string[] }> {
    const map = new Map<string, string[]>();

    nodes.forEach(n => {
      const category = (n.category || 'General').trim() || 'General';
      const title = (n.title || '').trim();

      if (!title) return;

      const next = map.get(category) ?? [];
      next.push(title);
      map.set(category, next);
    });

    const groups: Array<{ category: string; titles: string[] }> = [];

    map.forEach((titles, category) => {
      groups.push({ category, titles });
    });

    return groups;
  }

  private async fetchAndGroupControls() {
    this.isLoading = true;
    this.errorMessage = '';
    this.groupedCategories = [];
    this.totalControls = 0;
    this.expandedByCategory = {};

    try {
      const { nodes, totalCount } = await this.fetchAllControls();
      const groups = this.groupByCategory(nodes);

      this.totalControls = totalCount || nodes.length;
      this.groupedCategories = groups;
    } catch (err) {
      this.errorMessage = this.toErrorMessage(err);
    } finally {
      this.isLoading = false;
    }
  }

  // ----------  ui helpers (static mode)  ----------

  private toggleExpanded = () => {
    this.isExpanded = !this.isExpanded;
  };

  // ----------  ui helpers (controls mode)  ----------

  private isCategoryExpanded(category: string): boolean {
    return Boolean(this.expandedByCategory[category]);
  }

  private toggleCategoryExpanded = (category: string) => {
    const next = { ...this.expandedByCategory };
    next[category] = !Boolean(next[category]);
    this.expandedByCategory = next;
  };

  // ----------  render helpers (shared list row)  ----------

  private renderBulletRow(text: string) {
    return (
      <li class="item">
        {this.iconSrc ? (
          <span class="iconWrap" aria-hidden="true">
            <img class="iconImg" src={this.iconSrc} alt="" />
          </span>
        ) : (
          <span class="iconDot" aria-hidden="true" />
        )}

        <span class="text">{text}</span>
      </li>
    );
  }

  // ----------  render (static mode)  ----------

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
          {visibleItems.map(t => this.renderBulletRow(t))}

          {!this.isExpanded && hiddenCount > 0 && (
            <li class="more" aria-hidden="true">
              +{hiddenCount} more
            </li>
          )}
        </ul>
      </div>
    );
  }

  // ----------  render (controls mode)  ----------

  private renderControlsTile() {
    if (!this.showTile) return null;

    const categoriesCount = this.groupedCategories.length;
    const subtitle = (this.tileSubtitle || '').trim();

    return (
      <div class="tile">
        <div class="tileHeadingRow">
          <h3 class="tileTitle">{this.tileTitle || 'Selected Controls'}</h3>

          {this.showMeta && (
            <div class="tileMeta">
              {this.totalControls} controls&nbsp;&nbsp;{categoriesCount}{' '}
              categories
            </div>
          )}
        </div>

        {subtitle && <div class="tileSubtitle">{subtitle}</div>}
      </div>
    );
  }

  private renderControlsCards() {
    const limitCategories = this.getCategoryLimit();
    const limitItems = this.getPreviewLimit();

    const visibleCategories = this.groupedCategories.slice(0, limitCategories);

    if (this.isLoading) {
      return <div class="notice">Loading selected controls…</div>;
    }

    if (this.errorMessage) {
      return (
        <div class="notice isError">
          Failed to load controls from GraphQL.
          <div class="noticeDetail">{this.errorMessage}</div>
        </div>
      );
    }

    if (!visibleCategories.length) {
      return <div class="notice">No controls available.</div>;
    }

    return (
      <div class="groupWrap">
        {visibleCategories.map(group => {
          const isOpen = this.isCategoryExpanded(group.category);
          const hasOverflow = group.titles.length > limitItems;

          const visibleTitles = isOpen
            ? group.titles
            : group.titles.slice(0, limitItems);
          const hiddenCount = group.titles.length - visibleTitles.length;

          const buttonText = isOpen ? 'View Less' : 'View All';

          return (
            <div class="card">
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
                {visibleTitles.map(t => this.renderBulletRow(t))}

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

  // ----------  render (root)  ----------

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
