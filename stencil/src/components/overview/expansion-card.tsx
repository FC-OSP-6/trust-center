/* ======================================================
  TL;DR  -->  expandable bullet list card

  - renders a titled card for grouped content
  - shows a capped preview list (default: 3)
  - toggles full list via "view all" / "view less"
  - shows "+n more" only when collapsed
  - supports optional custom bullet icon via url
====================================================== */

import { Component, Prop, State, Watch, h } from "@stencil/core";

@Component({
  tag: "aon-expansion-card",
  styleUrl: "expansion-card.css",
  shadow: true,
})
export class ExpansionCard {
  // ----------  public api (attributes)  ----------

  @Prop({ attribute: "card-title" }) cardTitle: string = "";

  @Prop({ attribute: "bullet-points-json" }) bulletPointsJson: string = "[]";

  @Prop({ attribute: "icon-src" }) iconSrc?: string;

  @Prop({ attribute: "preview-limit" }) previewLimit: number = 3;


  // ----------  internal state  ----------

  @State() isExpanded: boolean = false;

  @State() bulletPoints: string[] = [];


  // ----------  lifecycle  ----------

  componentWillLoad() {
    this.syncBulletPoints(this.bulletPointsJson);
  }


  // ----------  watchers  ----------

  @Watch("bulletPointsJson")
  onBulletPointsJsonChange(next: string) {
    this.syncBulletPoints(next);
  }


  // ----------  parsing helpers  ----------

  private syncBulletPoints(raw: string) {
    this.bulletPoints = this.parseBulletPoints(raw);
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

  private getPreviewLimit(): number {
    const n = Number(this.previewLimit);

    if (!Number.isFinite(n)) return 3;
    if (n <= 0) return 3;

    return Math.floor(n);
  }


  // ----------  ui helpers  ----------

  private toggleExpanded = () => {
    this.isExpanded = !this.isExpanded;
  };


  // ----------  render  ----------

  render() {
    const title = this.cardTitle || "";
    const items = this.bulletPoints;
    const limit = this.getPreviewLimit();

    const hasOverflow = items.length > limit;
    const visibleItems = this.isExpanded ? items : items.slice(0, limit);
    const hiddenCount = items.length - visibleItems.length;

    const buttonText = this.isExpanded ? "View Less" : "View All";

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
          {visibleItems.map((text) => (
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
          ))}

          {!this.isExpanded && hiddenCount > 0 && (
            <li class="more" aria-hidden="true">
              +{hiddenCount} more
            </li>
          )}
        </ul>
      </div>
    );
  }
}
