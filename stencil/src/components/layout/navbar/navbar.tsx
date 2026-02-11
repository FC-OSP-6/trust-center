/* ======================================================
  TL;DR → Section navigation bar

  Responsibilities:
  - Render primary navigation tabs for Trust Center sections
  - Provide anchor-based navigation to Overview, Controls, Resources, and FAQs
  - Act as a visual affordance for section switching / expansion
  - Remain stateless; interaction behavior is owned by the host application

  Data contract:
  - Navigation structure is currently static
  - Future iterations may accept section config from the host
====================================================== */

import { Component, h } from '@stencil/core';
// Stencil core decorator + JSX factory
// Component is presentational only; no props, state, or events

@Component({
  tag: 'aon-navbar',
  styleUrl: 'navbar.css',
  shadow: true, // isolate DOM + styles for design-system safety
})
export class AonNavbar {
  // ---- Render ----
  // Renders a static navigation list; routing / expansion handled externally

  render() {
    return (
      <nav aria-label="Trust Center section navigation">
        <ul class="navbar-content">
          <li class="nav-tab">
            <a href="/trust-center/overview">Overview</a>
          </li>

          <li class="nav-tab">
            <a href="/trust-center/controls">Controls</a>
          </li>

          <li class="nav-tab">
            <a href="/trust-center/resources">Resources</a>
          </li>

          <li class="nav-tab">
            <a href="/trust-center/faqs">FAQs</a>
          </li>
        </ul>
      </nav>
    );
  }
}
