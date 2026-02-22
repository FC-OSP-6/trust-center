/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  browser entry point

  - registers stencil custom elements once
  - mounts react app into #root
  - imports client styles
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../../stencil/dist/components/components.css'; // TEMP: broken path / generated-file race
import './styles.css';
import App from './app';
import { defineCustomElements } from '../../stencil/loader';

defineCustomElements(window);

const container = document.getElementById('root');

if (!container) throw new Error('root container (#root) was not found');

const root = createRoot(container);

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
