/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  grouped controls as expandable cards (aon-style)

  - stencil owns all logic:
      - fetches controls from graphql (data-mode="controls")
      - groups nodes by category
      - derives meta: "<n> controls <m> categories"
      - per-card expand/collapse state (each category independent)
  - ui behavior:
      - 2 cards per row (desktop/tablet), 1 column on mobile
      - header contains:
          - optional tile title, optional derived meta, optional subtitle
          - per-category card header with +/- toggle (animated)
      - collapsed:
          - show all control titles + status icons
      - expanded:
          - show titles + descriptions (descriptions expand downward from title row)
  - status column icons are centered under the toggle column
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { Component, Prop, State, h } from "@stencil/core";

// ---------- local types ----------

type ControlNode = {
  id: string;
  title: string;
  description: string;
  category: string;
  updatedAt: string;
  sourceUrl?: string | null;
};

type ControlsConnectionResponse = {
  data?: {
    controlsConnection?: {
      totalCount?: number;
      edges?: Array<{ node?: ControlNode }>;
    };
  };
  errors?: Array<{ message?: string }>;
};

type CategoryGroup = {
  title: string;
  items: Array<{ id: string; title: string; description: string }>;
};

// ---------- graphql doc (kept local so stencil owns grouping) ----------

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

@Component({
  tag: "aon-control-card",
  styleUrl: "control-card.css",
  shadow: true,
})
export class ControlCard {
  // ---------- public api (attributes) ----------

  // data-mode="controls" -> stencil fetches and groups
  @Prop({ attribute: "data-mode" }) dataMode: "controls" | "none" = "none";

  // controls fetch sizing (mvp defaults)
  @Prop({ attribute: "fetch-first" }) fetchFirst: number = 100;

  // optional tile header rendering (all optional)
  @Prop({ attribute: "show-tile" }) showTile: boolean = false;
  @Prop({ attribute: "title-text" }) titleText?: string; // optional
  @Prop({ attribute: "show-meta" }) showMeta: boolean = false; // derived, not hardcoded
  @Prop({ attribute: "subtitle-text" }) subtitleText?: string; // optional

  // status icon (reuse your earlier green check)
  @Prop({ attribute: "icon-src" }) iconSrc?: string;

  // ---------- internal state ----------

  @State() groups: CategoryGroup[] = [];
  @State() totalControls: number = 0;

  // per-category expansion state
  @State() expandedByKey: Record<string, boolean> = {};

  // ---------- lifecycle ----------

  async componentWillLoad() {
    if (this.dataMode !== "controls") return;

    try {
      const { groups, totalCount } = await this.fetchAndGroupControls();
      this.groups = groups;
      this.totalControls = totalCount;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[aon-control-card] controls load failed:", msg);
      this.groups = [];
      this.totalControls = 0;
    }
  }

  // ---------- data ----------

  private getFetchFirst(): number {
    const n = Number(this.fetchFirst);
    if (!Number.isFinite(n) || n <= 0) return 100;
    return Math.floor(n);
  }

  private async fetchAndGroupControls(): Promise<{ groups: CategoryGroup[]; totalCount: number }> {
    const first = this.getFetchFirst();

    const res = await fetch("/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: CONTROLS_CONNECTION_QUERY,
        variables: { first, after: null, category: null, search: null },
      }),
    });

    if (!res.ok) throw new Error(`NETWORK_ERROR: http ${res.status}`);

    const json = (await res.json()) as ControlsConnectionResponse;

    if (json.errors && json.errors.length) {
      const msg = json.errors.map((e) => e.message ?? "unknown graphql error").join(" | ");
      throw new Error(`GRAPHQL_ERROR: ${msg}`);
    }

    const nodes =
      json.data?.controlsConnection?.edges
        ?.map((e) => e.node)
        .filter((n): n is ControlNode => Boolean(n && n.id && n.title && n.category)) ?? [];

    const totalCount = Number(json.data?.controlsConnection?.totalCount ?? nodes.length) || nodes.length;

    // group by category -> list of controls
    const map = new Map<string, Array<{ id: string; title: string; description: string }>>();
    for (const n of nodes) {
      const cat = (n.category || "General").trim() || "General";
      const list = map.get(cat) ?? [];
      list.push({
        id: n.id,
        title: (n.title || "").trim(),
        description: (n.description || "").trim(),
      });
      map.set(cat, list);
    }

    const groups: CategoryGroup[] = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([title, items]) => ({
        title,
        items: items.sort((a, b) => a.title.localeCompare(b.title)),
      }));

    return { groups, totalCount };
  }

  // ---------- ui helpers ----------

  private isExpanded(key: string): boolean {
    return Boolean(this.expandedByKey[key]);
  }

  private toggleExpanded(key: string) {
    this.expandedByKey = { ...this.expandedByKey, [key]: !this.isExpanded(key) };
  }

  private renderStatusIcon() {
    if (!this.iconSrc) {
      // fallback: simple dot so layout stays stable even if icon missing
      return <span class="statusDot" aria-hidden="true" />;
    }

    return <img class="statusIcon" src={this.iconSrc} alt="" aria-hidden="true" />;
  }

  private renderTileHeader() {
    if (!this.showTile) return null;

    const title = (this.titleText ?? "").trim();
    const subtitle = (this.subtitleText ?? "").trim();

    const categoriesCount = this.groups.length;
    const metaText = `${this.totalControls} controls ${categoriesCount} categories`;

    return (
      <header class="tileHeader">
        <div class="tileText">
          {title.length > 0 && <h2 class="tileTitle">{title}</h2>}

          {/* meta is derived; only render if enabled */}
          {this.showMeta && <div class="tileMeta">{metaText}</div>}

          {/* subtitle is optional; render only if non-empty */}
          {subtitle.length > 0 && <div class="tileSubtitle">{subtitle}</div>}
        </div>
      </header>
    );
  }

  private renderCategoryCard(group: CategoryGroup) {
    const key = group.title;
    const expanded = this.isExpanded(key);

    return (
      <section class="card">
        <button
          class="cardHeader"
          type="button"
          aria-expanded={expanded}
          onClick={() => this.toggleExpanded(key)}
        >
          <div class="cardHeaderLeft">
            <h3 class="cardTitle">{group.title}</h3>
          </div>

          <div class="cardHeaderRight">
            {/* +/- toggle (animated) */}
            <span class={{ toggleIcon: true, isOpen: expanded }} aria-hidden="true">
              <span class="toggleBarH" />
              <span class="toggleBarV" />
            </span>
          </div>
        </button>

        {/* column headers (no line breaks; grid aligns rows) */}
        <div class="columns" role="presentation">
          <div class="colLeft">Control</div>
          <div class="colRight">Status</div>
        </div>

        <ul class="rows" role="list">
          {group.items.map((c) => {
            const hasDesc = (c.description ?? "").trim().length > 0;

            return (
              <li class="row" key={c.id}>
                <div class="rowLeft">
                  <div class="rowTitle">{c.title}</div>

                  {/* description "pulls out downward" only when expanded */}
                  {hasDesc && (
                    <div class={{ rowDescWrap: true, isOpen: expanded }} aria-hidden={!expanded}>
                      <div class="rowDescInner">{c.description}</div>
                    </div>
                  )}
                </div>

                <div class="rowRight">{this.renderStatusIcon()}</div>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  // ---------- render ----------

  render() {
    return (
      <div class="wrap">
        {this.renderTileHeader()}

        <div class="grid">
          {this.groups.map((g) => this.renderCategoryCard(g))}
        </div>
      </div>
    );
  }
}