/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  shell-level dark/light mode toggle

  - self-contained: reads storage + system preference on load
  - on toggle: updates local state, document.documentElement.dataset.theme,
    localStorage, and fires window 'tc-theme-change' so React ThemeProvider stays in sync
  - persistence key: tc-theme (matches React layer)
  - fixed-positioned via :host — no layout impact on consuming shell
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { Component, State, h } from '@stencil/core';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'tc-theme';

@Component({
  tag: 'aon-theme-toggle',
  styleUrl: 'theme-toggle.css',
  shadow: true
})
export class ThemeToggle {
  @State() theme: Theme = 'light';

  componentWillLoad() {
    this.theme = this.resolveInitialTheme();
  }

  private resolveInitialTheme(): Theme {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {
      /* storage blocked */
    }

    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } catch {
      /* matchMedia unavailable */
    }

    return 'light';
  }

  private toggle() {
    const next: Theme = this.theme === 'light' ? 'dark' : 'light';
    this.theme = next;
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage blocked */
    }
    window.dispatchEvent(
      new CustomEvent('tc-theme-change', { detail: { theme: next } })
    );
  }

  render() {
    const isDark = this.theme === 'dark';
    return (
      <button
        type="button"
        class="toggle"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-pressed={isDark}
        onClick={() => this.toggle()}
      >
        {isDark ? 'Dark' : 'Light'}
      </button>
    );
  }
}
