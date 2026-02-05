/* ======================================================
  TL;DR → Link list card

  Responsibilities:
  - Render a titled card containing navigational links
  - Display links in a clear, scannable list format
  - Support truncated list display with optional host-controlled expansion
  - Act as a presentational shell for broker/client navigation

  Data contract:
  - `title`: string displayed as the card heading
  - `links`: ordered list of navigation objects:
      {
        label: string; // visible link text
        href: string;  // destination URL
      }
====================================================== */

import { Component, Prop, h } from '@stencil/core';
// Stencil core decorators + JSX factory
// Component is presentational only; state and expansion are owned by the host (React)

@Component({
  tag: 'link-card',
  styleUrl: 'link-card.css',
  shadow: true, // isolate DOM + styles for design-system safety
})
export class LinkCard {
  // ---- Public API (controlled by host application) ----

  /** Display title for the card */
  @Prop() linkCardTitle!: string;

  /** Ordered list of navigation links */
  @Prop() links: Array<{ label: string; href: string }> = [];

  // ---- Render ----
  // Renders a capped preview of links; expansion handled externally

  render() {
    const { linkCardTitle, links } = this;

    // Limit visible links to initial preview count
    const visibleLinks = links.slice(0, 4);

    // Calculate overflow indicator count (if any)
    const hiddenCount = links.length - visibleLinks.length;

    return (
      <div class="link-card">
        <h1>{linkCardTitle}</h1>

        <ul class="link-list">
          {visibleLinks.map(({ label, href }, index) => (
            <li class="link-item" key={index}>
              <a href={href}>
                {label}
              </a>
            </li>
          ))}

          {/* Overflow indicator shown when additional links exist */}
          {hiddenCount > 0 && (
            <li class="link-item more-indicator">
              +{hiddenCount} more
            </li>
          )}
        </ul>
      </div>
    );
  }
}

// Example for what needs to happen in react:

// <link-card
//   title="Related Resources"
//   links={[
//     { label: 'SOC 2 Report', href: '/docs/soc2' },
//     { label: 'Data Retention Policy', href: '/policies/data-retention' },
//     { label: 'Security Overview', href: '/security' },
//   ]}
// />
