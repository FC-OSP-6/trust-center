/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  reusable blue call-to-action web component

  - renders title + description + cta link in a single presentational component
  - uses an anchor for navigation (fixes invalid nested interactive pattern)
  - keeps zero business logic and no internal state
  - exposes props so react can stay thin and pass content only
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { Component, Prop, h } from '@stencil/core'; // stencil decorators + jsx factory

@Component({
  tag: 'aon-blue-card', // custom element tag
  styleUrl: './blue-cards.css', // component-scoped styles
  shadow: true // style + dom encapsulation
})
export class AonBlueCard {
  @Prop() blueCardTitle: string = ''; // heading text
  @Prop() blueCardDescription: string = ''; // body text
  @Prop() blueCardButtonText: string = 'Visit'; // cta label
  @Prop() blueCardButtonLink: string = ''; // cta destination

  // ----------  render helpers  ----------

  private getSafeHref(): string {
    const href = (this.blueCardButtonLink ?? '').trim(); // normalize empty values

    if (!href) return '#'; // fallback keeps markup stable when no link is provided

    return href; // use provided url as-is
  } // simple normalization helper keeps render cleaner

  // ----------  render  ----------

  render() {
    const href = this.getSafeHref(); // normalized destination url
    const isDisabled = href === '#'; // disable-style state when link missing

    return (
      <section
        class="blue-card"
        aria-label={this.blueCardTitle || 'Portal Callout'}
      >
        <div class="blue-card-text">
          {this.blueCardTitle && (
            <h5 class="blue-card-title">{this.blueCardTitle}</h5>
          )}

          {this.blueCardDescription && (
            <p class="blue-card-description">{this.blueCardDescription}</p>
          )}
        </div>

        <a
          class={{
            'blue-card-button': true, // base cta button styling
            'blue-card-button--disabled': isDisabled // visual disabled state when href missing
          }}
          href={href}
          target={isDisabled ? undefined : '_blank'}
          rel={isDisabled ? undefined : 'noopener noreferrer'}
          aria-disabled={isDisabled ? 'true' : undefined}
          onClick={isDisabled ? e => e.preventDefault() : undefined}
        >
          {this.blueCardButtonText || 'Visit'}
        </a>
      </section>
    );
  }
}
