/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  theme contract, provider, and hook

  - Theme type + stable persistence key (tc-theme)
  - resolveInitialTheme: read storage → fall back to system preference
  - initTheme: called once in index.tsx before React mounts (prevents flash)
  - ThemeProvider: manages theme state, syncs to <html data-theme> + localStorage;
    listens to window 'tc-theme-change' so React state stays in sync when
    the Stencil aon-theme-toggle fires after a user interaction
  - useTheme: hook for any component that needs current theme or toggleTheme
  - visual toggle is aon-theme-toggle (Stencil web component)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'tc-theme';

// ---------- helpers ----------

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return null;
  } catch {
    return null; // blocked storage — continue without persistence
  }
}

function readSystemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light'; // fallback when matchMedia is unavailable
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function resolveInitialTheme(): Theme {
  return readStoredTheme() ?? readSystemTheme();
}

/** Call once before React mounts to apply theme without a flash. */
export function initTheme(): void {
  applyTheme(resolveInitialTheme());
}

// ---------- context ----------

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ---------- provider ----------

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(resolveInitialTheme);

  // sync document attribute + storage whenever React state changes
  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // storage blocked — continue without persistence
    }
  }, [theme]);

  // sync React state when aon-theme-toggle fires tc-theme-change
  useEffect(() => {
    function onStencilToggle(e: Event) {
      const next = (e as CustomEvent<{ theme: Theme }>).detail?.theme;
      if (next === 'light' || next === 'dark') setTheme(next);
    }
    window.addEventListener('tc-theme-change', onStencilToggle);
    return () => window.removeEventListener('tc-theme-change', onStencilToggle);
  }, []);

  function toggleTheme() {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ---------- hook ----------

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
