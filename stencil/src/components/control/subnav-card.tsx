/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  In-page section jump navigation card

  - stencil renders only; react supplies title + subnav items json
  - removes hardcoded category labels/hrefs to prevent drift from api data
  - supports any number of categories/pages (controls, faqs, future sections)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { Component, Prop, State, Watch, h } from '@stencil/core';

// ---------- local types (json payload shape from react) ----------

type SubnavItem = {
  label: string; // visible link text
  href: string; // fragment target (or full href)
};

@Component({
  tag: 'aon-subnav-card',
  styleUrl: './subnav-card.css',
  shadow: true
})
export class AonSubnavCard {
  // ---------- public api ----------

  @Prop() subnavCardTitle: string = 'Categories'; // heading text
  @Prop() itemsJson: string = '[]'; // react passes serialized subnav item list
  @Prop() emptyText: string = ''; // optional empty-state text (omit to hide)

  // ---------- internal parsed state ----------

  @State() items: SubnavItem[] = [];

  // ---------- lifecycle ----------

  componentWillLoad() {
    this.syncItemsFromJson(this.itemsJson);
  }

  // ---------- watchers ----------

  @Watch('itemsJson')
  onItemsJsonChange(next: string) {
    this.syncItemsFromJson(next);
  }

  // ---------- parsing ----------

  private syncItemsFromJson(raw: string) {
    const text = (raw ?? '').trim();

    if (!text) {
      this.items = [];
      return;
    }

    try {
      const parsed = JSON.parse(text) as unknown;

      if (!Array.isArray(parsed)) {
        this.items = [];
        return;
      }

      this.items = parsed
        .filter((item): item is SubnavItem => {
          if (!item || typeof item !== 'object') return false;

          const candidate = item as Partial<SubnavItem>;

          return (
            typeof candidate.label === 'string' &&
            candidate.label.trim().length > 0 &&
            typeof candidate.href === 'string' &&
            candidate.href.trim().length > 0
          );
        })
        .map(item => ({
          label: item.label.trim(),
          href: item.href.trim()
        }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      console.warn('[aon-subnav-card] items-json parse failed:', msg);

      this.items = [];
    }
  }

  // ---------- render ----------

  render() {
    const title = (this.subnavCardTitle ?? '').trim() || 'Categories';
    const emptyText = (this.emptyText ?? '').trim();

    // hide card entirely when no items and no explicit empty message was provided
    if (this.items.length === 0 && !emptyText) {
      return null;
    }

    return (
      <div class="subnav-card">
        <div class="subnav-card-title">{title}</div>

        {this.items.length > 0 ? (
          <ul class="subnav-card-links">
            {this.items.map(item => (
              <li>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
        ) : (
          <div class="subnav-card-empty">{emptyText}</div>
        )}
      </div>
    );
  }
}
