/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  reusable stencil link-list card with optional richer resource-row rendering

  - renders a titled card that displays a list of links from json string props
  - supports richer items (description/kind/icon/ctaLabel) when provided
  - keeps subtitle/chip/cta/description optional so wireframe-simple rows stay clean
  - remains backward compatible with simple legacy item shapes (label + href)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { Component, Prop, h } from '@stencil/core'; // stencil decorators + jsx factory

// ----------  json item shapes (runtime-validated loosely after parsing)  ----------

type LinkItem = {
  label?: string; // visible row label (preferred field)
  title?: string; // compatibility field if older payload uses title
  href?: string; // destination url
  iconSrc?: string; // optional icon url
  iconAlt?: string; // optional icon alt text
  description?: string; // optional supporting text under label
  kind?: 'pdf' | 'external' | string; // optional type chip label source
  ctaLabel?: string; // optional trailing cta text (only renders when explicitly provided)
}; // json payload is untrusted so all fields are optional here

@Component({
  tag: 'aon-link-card', // custom element tag used by react wrappers
  styleUrl: 'link-card.css', // component-scoped styles
  shadow: true // isolate dom + styles in shadow dom
})
export class LinkCard {
  @Prop() linkTitle: string = ''; // card title shown in header

  @Prop() linkSubtitle: string = ''; // optional helper text under title

  @Prop() items: string = '[]'; // json-stringified LinkItem[] passed by host framework

  // ----------  parse helpers  ----------

  private parseItems(): LinkItem[] {
    if (!this.items || this.items.trim() === '') return []; // empty prop means no rows

    try {
      const parsed = JSON.parse(this.items) as unknown; // parse untrusted json once per render

      if (!Array.isArray(parsed)) return []; // guard invalid payload shape

      return parsed as LinkItem[]; // narrow after array guard (row fields still validated per item)
    } catch {
      return []; // fail soft so ui does not crash on bad json
    }
  } // keeps render method cleaner and resilient

  private getLabel(item: LinkItem): string {
    return (item.label ?? item.title ?? '').trim(); // support legacy `title` payloads
  } // unified label getter for backward compatibility

  private getHref(item: LinkItem): string {
    return (item.href ?? '').trim(); // normalize missing href to empty string
  } // unified href getter

  private getKindLabel(item: LinkItem): string {
    if (item.kind === 'pdf') return 'PDF'; // normalized chip text for pdf resources
    if (item.kind === 'external') return 'External Link'; // normalized chip text for external resources
    return ''; // no chip when kind is absent or unknown
  } // keeps render logic readable

  private getCtaLabel(item: LinkItem): string {
    return (item.ctaLabel ?? '').trim(); // cta is now truly optional (no implicit default text)
  } // wireframe-simple rows omit cta unless explicitly provided

  // ----------  render  ----------

  render() {
    const parsedItems = this.parseItems(); // parse once per render

    const items = parsedItems.filter(
      item => this.getLabel(item) && this.getHref(item)
    ); // ignore invalid rows quietly

    if (!this.linkTitle && !this.linkSubtitle && items.length === 0)
      return null; // avoid empty container output

    return (
      <section class="wrap" aria-label={this.linkTitle || 'Links'}>
        <div class="card">
          {(this.linkTitle || this.linkSubtitle) && (
            <header class="header">
              {this.linkTitle && <h3 class="card-title">{this.linkTitle}</h3>}

              {this.linkSubtitle && (
                <p class="card-subtitle">{this.linkSubtitle}</p>
              )}
            </header>
          )}

          <ul class="link-list">
            {items.map((item, index) => {
              const label = this.getLabel(item); // normalized display label
              const href = this.getHref(item); // normalized destination
              const chip = this.getKindLabel(item); // normalized chip label (optional)
              const ctaLabel = this.getCtaLabel(item); // optional cta text
              const description = (item.description ?? '').trim(); // optional supporting text
              const hasDescription = description.length > 0; // helps css tighten layout when absent
              const hasCta = ctaLabel.length > 0; // helps css switch to two-column layout when present

              return (
                <li class="link-item" key={`${href}-${index}`}>
                  <a
                    class={{ 'link-row': true, 'has-cta': hasCta }}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={chip ? `${label} (${chip})` : label}
                  >
                    <div class="row-main">
                      {item.iconSrc && (
                        <img
                          class="icon"
                          src={item.iconSrc}
                          alt={item.iconAlt ?? ''}
                          aria-hidden={item.iconAlt ? undefined : 'true'}
                        />
                      )}

                      <div
                        class={{
                          'row-text': true,
                          'has-description': hasDescription
                        }}
                      >
                        <div class="row-title-wrap">
                          <span class="row-title">{label}</span>

                          {chip && <span class="row-chip">{chip}</span>}
                        </div>

                        {hasDescription && (
                          <p class="row-description">{description}</p>
                        )}
                      </div>
                    </div>

                    {hasCta && <span class="row-cta">{ctaLabel}</span>}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    );
  }
}
