/* ==========================================
   TL;DR --> Presentational Link Card

   - Non-interactive card
   - Renders a title and a list of links
   - Icon type passed from parent
   - Fully data-driven via JSON string prop
   - Shadow DOM isolated
========================================== */

import { Component, Prop, h } from '@stencil/core';

type LinkItem = {
  label: string;
  href: string;
  iconSrc?: string;
  iconAlt?: string;
};


@Component({
  tag: 'aon-link-card',
  styleUrl: 'link-card.css',
  shadow: true,
})
export class LinkCard {
  @Prop() linkTitle: string;
  @Prop() items: string; // JSON stringified array

  private parseItems(): LinkItem[] {
    try {
      return JSON.parse(this.items) || [];
    } catch {
      return [];
    }
  }


  render() {
  const items = this.parseItems();

  if (!this.linkTitle && items.length === 0) {
    return null;
  }

  return (
    <div class="wrap">
      <div class="card">
        <header class="header">
          <h3 class="card-title">{this.linkTitle}</h3>
        </header>

        <ul class="link-list" role="list">
  {items.map((item) => (
    <li class="link-item">
      {item.iconSrc && (
        <img
          class="icon"
          src={item.iconSrc}
          alt={item.iconAlt || ''}
        />
      )}

      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
      >
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
