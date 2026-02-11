/* ======================================================
  TL;DR → Expandable bullet list card

  Responsibilities:
  - Render a titled card for grouped content
  - Display a capped list of bullet items (default: 3)
  - Replace native bullets with a custom icon
  - Indicate additional hidden items via “+N more”
  - Delegate expansion behavior to the host framework (React)

  Data contract:
  - `title`: string displayed as card heading
  - `bulletPoints`: ordered list of display strings from backend
  - `icon`: optional URL used as a visual bullet replacement
====================================================== */

import { Component, Prop, h } from '@stencil/core'; 
// Stencil core decorators + JSX factory
// No state or events declared here; component is presentational only

@Component({
  tag: 'aon-expansion-card',
  styleUrl: 'expansion-card.css',
  shadow: true, // isolate DOM + styles for design-system safety
})
export class ExpansionCard {
  // ---- Public API (controlled by host application) ----

  /** Display title for the card */
  @Prop() expansionCardTitle!: string;

  /** Bullet content provided by backend or CMS */
  @Prop() bulletPoints: string[] = [];

  /** Optional icon URL used to replace default list markers */
  @Prop() icon?: string;

  // ---- Render ----
  // Renders a capped list view; expansion logic is owned by React

  render() {
    const { expansionCardTitle, bulletPoints, icon } = this;

    // Limit visible bullets to initial preview count
    const visibleItems = bulletPoints.slice(0, 3);

    // Calculate overflow indicator count (if any)
    const hiddenCount = bulletPoints.length - visibleItems.length;

    return (
      <div class="expansion-card">
        {/* Header row: title + expand affordance */}
        <header class="card-header">
          <h1>{expansionCardTitle}</h1>

          {/* Expansion intent handled by host; button is visual affordance only */}
          <button
            class="toggle-expansion"
            type="button"
            aria-label="Expand card content"
          >
            View All
          </button>
        </header>

        {/* Bullet list preview */}
        <ul class="bullet-list">
          {visibleItems.map((item, index) => (
            <li class="bullet-item" key={index}>
              {/* Custom bullet icon (if provided) */}
              {icon && (
                <span class="bullet-icon">
                  <img src={icon} alt="" aria-hidden="true" />
                </span>
              )}

              <span class="bullet-text">{item}</span>
            </li>
          ))}

          {/* Overflow indicator shown only when items exceed preview limit */}
          {hiddenCount > 0 && (
            <li class="bullet-item more-indicator">
              +{hiddenCount} more
            </li>
          )}
        </ul>
      </div>
    );
  }
}
