/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  Primary section navigation bar

  - stencil renders only; react owns routing + active-path calculation
  - nav items are passed as json to avoid hardcoded labels/hrefs in stencil
  - active item styling is derived from active-path prop (no window usage)
  - no history.pushState / popstate hacks (removes react-router coupling)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { Component, Prop, State, Watch, h, Host } from '@stencil/core';

// ---------- local types (json payload shape from react) ----------

type NavbarItem = {
  label: string; // ui text shown in navbar
  href: string; // final href rendered in anchor
  match?: 'exact' | 'prefix'; // active matching strategy (default: prefix)
};

@Component({
  tag: 'aon-navbar',
  styleUrl: 'navbar.css',
  shadow: true
})
export class AonNavbar {
  // ---------- public api ----------

  @Prop() itemsJson: string = '[]'; // react passes serialized navbar items
  @Prop() activePath: string = ''; // react passes current pathname from router
  @Prop() navAriaLabel: string = 'Primary navigation'; // accessible nav label

  // ---------- internal parsed state ----------

  @State() items: NavbarItem[] = [];

  // ---------- lifecycle ----------

  componentWillLoad() {
    this.syncItemsFromJson(this.itemsJson);
  }

  // ---------- watchers ----------

  @Watch('itemsJson')
  onItemsJsonChange(next: string) {
    this.syncItemsFromJson(next);
  }

  // ---------- parsing helpers ----------

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
        .filter((item): item is NavbarItem => {
          if (!item || typeof item !== 'object') return false;

          const candidate = item as Partial<NavbarItem>;

          return (
            typeof candidate.label === 'string' &&
            candidate.label.trim().length > 0 &&
            typeof candidate.href === 'string' &&
            candidate.href.trim().length > 0
          );
        })
        .map(item => ({
          label: item.label.trim(),
          href: item.href.trim(),
          match: item.match === 'exact' ? 'exact' : 'prefix'
        }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      console.warn('[aon-navbar] items-json parse failed:', msg);

      this.items = [];
    }
  }

  // ---------- active-state helpers ----------

  private normalizePath(path: string): string {
    const raw = (path ?? '').trim();

    if (!raw) return '';

    // strip query + hash so active matching only compares paths
    const noHash = raw.split('#')[0] ?? '';
    const noQuery = noHash.split('?')[0] ?? '';

    // keep root as "/" but trim trailing slash elsewhere for stable matching
    if (noQuery === '/') return '/';

    return noQuery.replace(/\/+$/, '');
  }

  private isActive(item: NavbarItem): boolean {
    const current = this.normalizePath(this.activePath);
    const target = this.normalizePath(item.href);

    if (!current || !target) return false;

    if (item.match === 'exact') {
      return current === target;
    }

    // prefix matching with boundary check avoids false positives
    // example: "/controls" should match "/controls" and "/controls/x"
    // but not "/controls-extra"
    if (current === target) return true;

    return current.startsWith(`${target}/`);
  }

  // ---------- render ----------

  render() {
    return (
      <Host>
        <nav class="navbar" aria-label={this.navAriaLabel}>
          {this.items.map(item => (
            <a
              href={item.href}
              class={`nav-item ${this.isActive(item) ? 'active' : ''}`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </Host>
    );
  }
}
