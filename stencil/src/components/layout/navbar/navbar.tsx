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

import { Component, h, State, Host } from '@stencil/core';
// Stencil core decorator + JSX factory
// Component is presentational only; no props, state, or events

@Component({
  tag: 'aon-navbar',
  styleUrl: 'navbar.css',
  shadow: true, // isolate DOM + styles for design-system safety
})
export class AonNavbar {
  // Renders a static navigation list; routing / expansion handled externally
 
  //Track current URL path for active link highlighting 
@State() currentPath: string = window.location.pathname;

  // Set up listener for browser back/forward buttons
  componentWillLoad() {
    window.addEventListener('popstate', () => {
      this.currentPath = window.location.pathname; // Update active link on navigation

    });
  }
  // Check if given path matches current page
  isCurrentPage(path: string): boolean {
    return this.currentPath.includes(path);
  }

  // Handle click navigation without page reload (SPA behavior)
  navigateTo(path: string, e: Event) {
    e.preventDefault(); // Stop default link behavior (prevents page reload)
    window.history.pushState({}, '', `/trust-center${path}`); // Update URL bar
    window.dispatchEvent(new PopStateEvent('popstate')); // Notify React Router
    this.currentPath = window.location.pathname; // Update active state
  }

  render() {
    return (
      <Host>
        <nav class="navbar">
          {/* Overview link - dynamically add 'active' class if on this page */}
          <a
            href="/trust-center/overview"
            class={`nav-item ${this.isCurrentPage('/overview') ? 'active' : ''}`}
            onClick={(e) => this.navigateTo('/overview', e)}
          >
            OVERVIEW
          </a>

          {/* Controls link */}
          <a
            href="/trust-center/controls"
            class={`nav-item ${this.isCurrentPage('/controls') ? 'active' : ''}`}
            onClick={(e) => this.navigateTo('/controls', e)}
          >
            CONTROLS
          </a>

          {/* Resources link */}
          <a
            href="/trust-center/resources"
            class={`nav-item ${this.isCurrentPage('/resources') ? 'active' : ''}`}
            onClick={(e) => this.navigateTo('/resources', e)}
          >
            RESOURCES
          </a>

          {/* FAQ link */}
          <a
            href="/trust-center/faqs"
            class={`nav-item ${this.isCurrentPage('/faqs') ? 'active' : ''}`}
            onClick={(e) => this.navigateTo('/faqs', e)}
          >
            FAQ
          </a>
        </nav>
      </Host>
    );
  }
}
