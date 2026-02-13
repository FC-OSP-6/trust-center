/* ================================
  tl;dr  -->  The first file that runs in the browser
  1. This file mounts the app onto the page
================================ */

import React, { StrictMode } from 'react';
import type {} from './types-frontend'; // ensures jsx intrinsic element types are always loaded
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../../stencil/dist/trust-center/trust-center.css';
import './styles.css';

import App from './app';
import { defineCustomElements } from '../../stencil/loader/index.es2017.js';

// Register Stencil Web Components once
defineCustomElements(window);

const container = document.getElementById('root')!;
const root = createRoot(container);

root.render(
  <StrictMode>
    <BrowserRouter
      basename="/trust-center"
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <App />
    </BrowserRouter>
  </StrictMode>,
);
