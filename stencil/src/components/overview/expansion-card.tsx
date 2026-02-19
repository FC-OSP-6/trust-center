/* ======================================================
  TL;DR  -->  expandable bullet list card (single or grouped)

  - supports 3 modes:
      1) single list mode via bullet-points-json
      2) grouped mode via groups-json (renders multiple cards)
      3) auto-load grouped controls via data-mode="controls" (graphql default; server falls back to seed json)
  - renders cards in a responsive grid (css controls 3 -> 2 -> 1 columns)
  - keeps most logic + styling in stencil (react passes only minimal configuration)
  - per-card expansion state in grouped mode (each group expands independently)
  - supports icon variant so this pattern can be reused (ex: link cards)
  - optional "tile header" section (Selected Controls) above the grid
====================================================== */

import { Component, Prop, State, Watch, h } from "@stencil/core";

// ----------  local types  ----------

type ExpansionGroup = {
  title: string;
  items: string[];
};

// graphql node shape we need for controls -> category groups
type ControlsConnectionNode = {
  id: string;
  title: string;
  description: string;
  category: string;
  sourceUrl?: string | null;
  updatedAt: string;
};

// graphql response shape for minimal parsing
type ControlsConnectionResponse = {
  data?: {
    controlsConnection?: {
      totalCount?: number;
      edges?: Array<{ node?: ControlsConnectionNode }>;
    };
  };
  errors?: Array<{ message?: string }>;
};

// graphql document string  --> kept local so stencil can own the grouping logic
const CONTROLS_CONNECTION_QUERY = `
  query ControlsConnection($first: Int!, $after: String, $category: String, $search: String) {
    controlsConnection(first: $first, after: $after, category: $category, search: $search) {
      totalCount
      edges {
        node {
          id
          title
          description
          category
          sourceUrl
          updatedAt
        }
      }
    }
  }
`;
// REVIEW: CONTROLS_CONNECTION_QUERY is duplicated with control-card.tsx – extract to a shared module (e.g. graphql/controls.ts) to avoid schema drift.

@Component({
  tag: "aon-expansion-card",
  styleUrl: "expansion-card.css",
  shadow: true,
})
export class ExpansionCard {
  // ----------  public api (attributes)  ----------

  // single card title (single list mode)
  @Prop({ attribute: "card-title" }) cardTitle: string = "";

  // single list items (single list mode)
  @Prop({ attribute: "bullet-points-json" }) bulletPointsJson: string = "[]";

  // grouped cards (grouped mode) --> [{ title, items[] }]
  @Prop({ attribute: "groups-json" }) groupsJson: string = "[]";

  // optional limit for number of groups rendered (grouped mode) --> 0 means "show all"
  @Prop({ attribute: "group-limit" }) groupLimit?: number;

  // icon source for "img" variant (ex: green check)
  @Prop({ attribute: "icon-src" }) iconSrc?: string;

  // icon variant used per bullet
  @Prop({ attribute: "icon-variant" }) iconVariant: "img" | "dot" = "img";

  // how many bullet points to show when collapsed
  @Prop({ attribute: "preview-limit" }) previewLimit: number = 3;

  // data mode for auto-loading groups (keeps react dumb; stencil owns grouping)
  @Prop({ attribute: "data-mode" }) dataMode: "controls" | "none" = "none";

  // how many controls to fetch for grouped mode when data-mode="controls"
  @Prop({ attribute: "fetch-first" }) fetchFirst: number = 50;

  // optional tile header (section heading above the grid)
  @Prop({ attribute: "show-tile" }) showTile: boolean = false;

  // optional tile title (defaults to "Selected Controls" when omitted)
  @Prop({ attribute: "tile-title" }) tileTitle: string = "";

  // optional tile subtitle (renders only when non-empty)
  @Prop({ attribute: "tile-subtitle" }) tileSubtitle: string = "";

  // optional derived meta line visibility (meta is derived, not hardcoded)
  @Prop({ attribute: "show-meta" }) showMeta: boolean = false;

  // ----------  internal state  ----------

  // single card expansion state (single list mode)
  @State() isExpanded: boolean = false;

  // parsed single-list items
  @State() bulletPoints: string[] = [];

  // parsed groups for grouped mode (or fetched groups for data-mode="controls")
  @State() groups: ExpansionGroup[] = [];

  // per-group expansion state (grouped mode) --> avoids expanding all cards at once
  @State() expandedByKey: Record<string, boolean> = {};

  // derived counts for tile meta (controls mode)
  @State() derivedTotalCount: number | null = null;

  // ----------  lifecycle  ----------

  async componentWillLoad() {
    // always sync parsed props first so we can detect host-provided grouped mode
    this.syncBulletPoints(this.bulletPointsJson);
    this.syncGroups(this.groupsJson);

    // if host provided groups-json, we do not auto-load
    const hasProvidedGroups = this.groups.length > 0;

    // auto-load controls groups from graphql when requested
    if (this.dataMode === "controls" && !hasProvidedGroups) {
      try {
        const fetched = await this.fetchControlsGroups();
        this.groups = fetched.groups;
        this.derivedTotalCount = fetched.totalCount;
      } catch (err) {
        // keep failures readable for mvp debugging, but avoid crashing render
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[aon-expansion-card] controls load failed:", msg);
        this.groups = [];
        this.derivedTotalCount = null;
      }
    }
  }

  // ----------  watchers  ----------

  @Watch("bulletPointsJson")
  onBulletPointsJsonChange(next: string) {
    this.syncBulletPoints(next);
  }

  @Watch("groupsJson")
  onGroupsJsonChange(next: string) {
    this.syncGroups(next);
  }

  // ----------  parsing helpers  ----------

  private syncBulletPoints(raw: string) {
    this.bulletPoints = this.parseBulletPoints(raw);
  }

  private syncGroups(raw: string) {
    this.groups = this.parseGroups(raw);
  }

  private parseBulletPoints(raw: string): string[] {
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((v) => typeof v === "string")
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    } catch {
      return [];
    }
  }

  private parseGroups(raw: string): ExpansionGroup[] {
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];

      const groups = parsed
        .filter((g) => g && typeof g === "object")
        .map((g) => {
          const anyG = g as { title?: unknown; items?: unknown };
          const title = typeof anyG.title === "string" ? anyG.title.trim() : "";
          const itemsRaw = Array.isArray(anyG.items) ? anyG.items : [];

          const items = itemsRaw
            .filter((v) => typeof v === "string")
            .map((v) => v.trim())
            .filter((v) => v.length > 0);

          return { title, items };
        })
        .filter((g) => g.title.length > 0 && g.items.length > 0);

      return groups;
    } catch {
      return [];
    }
  }

  private getPreviewLimit(): number {
    const n = Number(this.previewLimit);
    if (!Number.isFinite(n)) return 3;
    if (n <= 0) return 3;
    return Math.floor(n);
  }

  private getGroupLimit(): number | null {
    const n = this.groupLimit == null ? NaN : Number(this.groupLimit);
    if (!Number.isFinite(n)) return null;

    // 0 means "show all" (explicitly requested by host)
    if (n === 0) return null;

    if (n < 0) return null;
    return Math.floor(n);
  }

  private getFetchFirst(): number {
    const n = Number(this.fetchFirst);
    if (!Number.isFinite(n)) return 50;
    if (n <= 0) return 50;
    return Math.floor(n);
  }

  private getTileTitle(): string {
    const raw = (this.tileTitle || "").trim();
    if (raw) return raw;
    return "Selected Controls";
  }

  private getTileSubtitle(): string {
    return (this.tileSubtitle || "").trim();
  }

  private getTileMetaText(): string {
    // meta is derived (counts), not hardcoded
    const total = this.derivedTotalCount;
    const categories = this.groups.length;

    // if we don't have a reliable count yet, do not render meta
    if (total == null) return "";

    // keep this plain-text so design tokens can style it (no pill, no outline)
    return `${categories} categories, ${total} controls`;
  }

  // ----------  data (graphql --> groups)  ----------

  private async fetchControlsGroups(): Promise<{ groups: ExpansionGroup[]; totalCount: number | null }> {
    const first = this.getFetchFirst();

    // note: backend is db-first and falls back to seed json automatically
    const res = await fetch("/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: CONTROLS_CONNECTION_QUERY,
        variables: { first, after: null, category: null, search: null },
      }),
    });

    // non-2xx should still surface cleanly
    if (!res.ok) {
      throw new Error(`NETWORK_ERROR: http ${res.status}`);
    }

    // parse json once
    const json = (await res.json()) as ControlsConnectionResponse;

    // graphql-level errors return 200 with errors[]
    if (json.errors && json.errors.length) {
      const msg = json.errors.map((e) => e.message ?? "unknown graphql error").join(" | ");
      throw new Error(`GRAPHQL_ERROR: ${msg}`);
    }

    const totalCount = typeof json.data?.controlsConnection?.totalCount === "number"
      ? json.data?.controlsConnection?.totalCount ?? null
      : null;

    // normalize nodes and ignore null edges
    const nodes =
      json.data?.controlsConnection?.edges
        ?.map((e) => e.node)
        // REVIEW: Filter doesn't require n.id – if downstream logic assumes id, add (n && n.id && n.title && n.category).
        // REVIEW: It is a good practice to always have id returned in node as it is used in cache invalidation.
        .filter((n): n is ControlsConnectionNode => Boolean(n && n.title && n.category)) ?? [];

    // group by category (category -> list of control titles)
    const map = new Map<string, string[]>();
    for (const n of nodes) {
      const cat = (n.category || "General").trim() || "General";
      const list = map.get(cat) ?? [];
      list.push(n.title.trim());
      map.set(cat, list);
    }

    // stable display order (alphabetical groups + alphabetical items)
    const groups: ExpansionGroup[] = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([title, items]) => ({
        title,
        items: items.sort((a, b) => a.localeCompare(b)),
      }));

    return { groups, totalCount };
  }

  // ----------  ui helpers  ----------

  private toggleExpanded = () => {
    // single list mode toggler
    this.isExpanded = !this.isExpanded;
  };

  private isGroupExpanded(key: string): boolean {
    return Boolean(this.expandedByKey[key]);
  }

  private toggleGroupExpanded(key: string) {
    // grouped mode toggler (copy-on-write to trigger stencil re-render)
    this.expandedByKey = { ...this.expandedByKey, [key]: !this.isGroupExpanded(key) };
  }

  // ----------  render helpers  ----------

  private renderBulletIcon() {
    // icon variant "dot" always renders dot
    if (this.iconVariant === "dot") {
      return <span class="iconDot" aria-hidden="true" />;
    }
    // REVIEW: CSS class names are usually kebab-case instead of camelCase (e.g. icon-dot, icon-wrap, tile-heading-row); consider renaming for consistency with common CSS conventions.
    // icon variant "img" uses iconSrc if provided
    if (this.iconSrc) {
      return (
        <span class="iconWrap" aria-hidden="true">
          <img class="iconImg" src={this.iconSrc} alt="" />
        </span>
      );
    }

    // fallback when img variant is requested but iconSrc is missing
    return <span class="iconDot" aria-hidden="true" />;
  }

  private renderTileHeader() {
    // tile header is optional and should never borrow the bordered card wrapper
    if (!this.showTile) return null;

    const title = this.getTileTitle();
    const subtitle = this.getTileSubtitle();

    const metaText = this.getTileMetaText();
    const shouldShowMeta = Boolean(this.showMeta && metaText);

    const shouldShowSubtitle = Boolean(subtitle);

    return (
      <div class="tile" part="tile">
        <div class="tileHeadingRow">
          <h2 class="tileTitle" part="tile-title">{title}</h2>
        </div>

        {shouldShowMeta && (
          <div class="tileMeta" part="tile-meta">
            {metaText}
          </div>
        )}

        {shouldShowSubtitle && (
          <div class="tileSubtitle" part="tile-subtitle">
            {subtitle}
          </div>
        )}
      </div>
    );
  }

  private renderSingleCard(args: { title: string; items: string[]; isExpanded: boolean; onToggle: () => void }) {
    const { title, items, isExpanded, onToggle } = args;

    const limit = this.getPreviewLimit();

    const hasOverflow = items.length > limit;
    const visibleItems = isExpanded ? items : items.slice(0, limit);
    const hiddenCount = items.length - visibleItems.length;

    const buttonText = isExpanded ? "View Less" : "View All";

    return (
      <div class="card">
        <header class="header">
          <h3 class="title">{title}</h3>

          {hasOverflow && (
            <button class="toggle" type="button" aria-expanded={isExpanded} onClick={onToggle}>
              {buttonText}
            </button>
          )}
        </header>

        <ul class="list" role="list">
          {/* REVIEW: <li class="item"> in map has no key – add key={text} or key={index} for list stability (Stencil/JSX reconciliation). */}
          {visibleItems.map((text) => (
            <li class="item">
              {this.renderBulletIcon()}
              <span class="text">{text}</span>
            </li>
          ))}

          {!isExpanded && hiddenCount > 0 && (
            <li class="more" aria-hidden="true">
              +{hiddenCount} more
            </li>
          )}
        </ul>
      </div>
    );
  }

  // ----------  render  ----------

  render() {
    // grouped mode has priority when groups exist
    const groupLimit = this.getGroupLimit();
    const groups = groupLimit ? this.groups.slice(0, groupLimit) : this.groups;

    if (groups.length > 0) {
      return (
        <div class="wrap">
          {this.renderTileHeader()}

          <div class="groupWrap">
            {groups.map((g) => {
              // category title is a stable key for our current dataset
              const key = g.title;

              return this.renderSingleCard({
                title: g.title,
                items: g.items,
                isExpanded: this.isGroupExpanded(key),
                onToggle: () => this.toggleGroupExpanded(key),
              });
            })}
          </div>
        </div>
      );
    }

    // fallback to original single list mode
    const title = this.cardTitle || "";
    const items = this.bulletPoints;

    // avoid rendering empty shells when host provides no data
    if (this.dataMode !== "controls" && title.trim() === "" && items.length === 0) {
      return null;
    }

    return (
      <div class="wrap">
        {this.renderTileHeader()}

        {this.renderSingleCard({
          title,
          items,
          isExpanded: this.isExpanded,
          onToggle: this.toggleExpanded,
        })}
      </div>
    );
  }
}
