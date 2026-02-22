/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  browser entry point

  - registers stencil custom elements once (browser-only guard for SSR/tests)
  - mounts react app into #root (browser-only)
  - imports client styles
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../../stencil/dist/components/components.css';
import './styles.css';
import App from './app';
import { defineCustomElements } from '../../stencil/loader';

// ---------- browser-only bootstrap ----------

const canUseBrowserDom =
  typeof window !== 'undefined' && typeof document !== 'undefined'; // guards browser globals for SSR/tests/build tooling

if (canUseBrowserDom) {
  defineCustomElements(window); // registers stencil web components only when window exists

  const container = document.getElementById('root'); // grabs react mount target from index.html

  if (!container) throw new Error('root container (#root) was not found'); // keeps debugging error explicit in browser mode

  const root = createRoot(container); // creates react root after container existence is confirmed

  root.render(
    <StrictMode>
      <BrowserRouter
        basename="/trust-center"
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <App />
      </BrowserRouter>
    </StrictMode>
  );
}
