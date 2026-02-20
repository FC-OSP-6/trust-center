/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   Link Card Presentational Web Component

   - Renders a title and external link list within Shadow DOM for style encapsulation.
   - Accepts link data as a JSON-stringified LinkItem[] from the parent (tradeoff: string parsing required vs. direct typed prop).
   - Stateless and fully data-driven; no internal state, events, or side effects.
   - Conditionally renders icons per item when iconSrc is provided.
   - Exports <aon-link-card> for use in React or other host frameworks.
   - Depends only on @stencil/core and local CSS (link-card.css).
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { Component, Prop, h } from '@stencil/core';

//TODO: List items in map have no key – add key={item.href} or key={index} for list stability (Stencil/JSX reconciliation).

/**
 * Shape of each link rendered inside the card.
 * Passed from parent via JSON-stringified `items` prop.
 */
type LinkItem = {
  label: string; // Visible link text
  href: string; // Destination URL
  iconSrc?: string; // Optional icon source path
  iconAlt?: string; // Optional alt text (defaults to empty string)
};

@Component({
  tag: 'aon-link-card',
  styleUrl: 'link-card.css',
  shadow: true
})
export class LinkCard {
  @Prop() linkTitle: string;
  @Prop() items: string; // JSON-stringified LinkItem[] passed from parent

  /**
   * Safely parses the JSON-stringified items prop.
   * Returns an empty array if parsing fails or no items are provided.
   */
  private parseItems(): LinkItem[] {
    try {
      return JSON.parse(this.items) || [];
    } catch {
      return [];
    }
  }

  render() {
    // Parse data once per render; component remains stateless
    const items = this.parseItems();

    if (!this.linkTitle && items.length === 0) {
      // Do not render empty container when no displayable content exists
      return null;
    }

    return (
      <div class="wrap">
        <div class="card">
          <header class="header">
            <h3 class="card-title">{this.linkTitle}</h3>
          </header>

          <ul class="link-list">
            {items.map(item => (
              <li class="link-item">
                {item.iconSrc && (
                  <img
                    class="icon"
                    src={item.iconSrc}
                    alt={item.iconAlt || ''}
                  />
                )}
                {/* External links open in new tab with security attributes */}
                <a href={item.href} target="_blank" rel="noopener noreferrer">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }
}
