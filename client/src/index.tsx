/* ================================
  tl;dr  -->  The first file that runs in the browser
  1. This file mounts the app onto the page
================================ */

import React from "react"
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "./app"

// Connect to the DOM
const container = document.getElementById(`root`)!;
const root = createRoot(container);

// render the root
root.render(
  <StrictMode>
<App />
</StrictMode>
);

