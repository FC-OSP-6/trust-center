// /* ================================
//   tl;dr  -->  The first file that runs in the browser
//   1. This file mounts the app onto the page
// ================================ */

// import React from "react"
// import { createRoot } from "react-dom/client";
// import { StrictMode } from "react";
// import App from "./app"
// import { defineCustomElements } from '@trustcenter/components/loader'

// // registers stencil components in react
// defineCustomElements();

// // Connect to the DOM
// const container = document.getElementById(`root`)!;
// const root = createRoot(container);

// // render the root
// root.render(
//   <StrictMode>
// <App />
// </StrictMode>
// );

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './app';
import { defineCustomElements } from '../../stencil/loader/index.es2017.js';

// Register Stencil Web Components once
defineCustomElements(window);

const container = document.getElementById('root')!;
const root = createRoot(container);

root.render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
