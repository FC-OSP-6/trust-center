/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  In-page section jump navigation card

  - stencil renders only; react supplies title + subnav items json
  - emits a composed custom event for hash-item clicks so react can scroll shadow-dom targets
  - keeps normal anchor behavior for non-hash links
  - supports any number of categories/pages (controls, faqs, future sections)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import {
  Component,
  Prop,
  State,
  Watch,
  Event as StencilEvent,
  EventEmitter,
  h
} from '@stencil/core';

// ---------- local types (json payload shape from react) ----------

type SubnavItem = {
  label: string; // visible link text
  href: string; // fragment target (or full href)
};

type SubnavJumpDetail = {
  href: string; // original href clicked by user
  id: string; // parsed fragment id without "#"
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

  // ---------- public events ----------

  @StencilEvent({
    eventName: 'aonSubnavJump',
    bubbles: true,
    composed: true
  })
  subnavJump!: EventEmitter<SubnavJumpDetail>; // react listens and performs shadow-dom scroll

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

  // ---------- click helpers ----------

  private getHashId(href: string): string {
    const text = (href ?? '').trim();

    if (!text.startsWith('#')) return '';

    return text.slice(1).trim();
  } // hash-only links are handled through the custom event so react can jump inside sibling shadow roots

  private onItemClick(ev: MouseEvent, item: SubnavItem) {
    // ignore modified clicks so browser keeps native behavior (new tab, etc.)
    if (ev.defaultPrevented) return;
    if (ev.button !== 0) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

    const href = (item.href ?? '').trim();
    const id = this.getHashId(href);

    // only intercept in-page hash links (leave full links alone)
    if (!id) return;

    ev.preventDefault(); // browser hash jump cannot see ids inside another component shadow root

    this.subnavJump.emit({
      href,
      id
    }); // react page scrolls the target card shadow-root section
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
              <li key={item.href}>
                <a href={item.href} onClick={ev => this.onItemClick(ev, item)}>
                  {item.label}
                </a>
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
