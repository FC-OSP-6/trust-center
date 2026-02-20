/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  Primary section navigation bar component

  - Manages active link state internally via @State(); tradeoff is that the navbar
    owns URL-awareness rather than receiving it from the React host, which creates
    a tight coupling to window.location and React Router's history stack.
  - SPA navigation is achieved by intercepting anchor clicks, calling
    window.history.pushState, and dispatching a synthetic popstate event to notify
    React Router; tradeoff is that this approach depends on React Router listening
    to popstate, which may break if the routing strategy changes.
  - Shadow DOM encapsulation chosen for style isolation; tradeoff is that global styles
    cannot pierce the shadow boundary without CSS custom properties.
  - Navigation structure is currently static; future iterations may accept section
    config as a prop from the React host.

  - Lives in: stencil/components/navbar/
  - Depends on: navbar.css (component-scoped styles), tokens.css (via CSS custom properties)
  - Exports: <aon-navbar> — consumed by the React host as the primary section
    navigation bar rendered beneath <aon-header> on all Trust Center pages.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { Component, h, State, Host } from '@stencil/core';
// Stencil core decorators and JSX factory; State is used for active link tracking

@Component({
  tag: 'aon-navbar',
  styleUrl: 'navbar.css',
  shadow: true // isolate DOM + styles for design-system safety
})
export class AonNavbar {
  // Renders a static navigation list; routing / expansion handled externally

  // Initialize empty - will be set in componentWillLoad for SSR safety
  @State() currentPath: string = '';

  // Store handler reference to enable proper cleanup on component unload
  private popstateHandler: () => void;

  // Runs before component renders - safe place for browser-only initialization
  componentWillLoad() {
    // Guard: Only access window in browser environment (SSR safe)
    if (typeof window !== 'undefined') {
      this.currentPath = window.location.pathname;

      // Create named handler function (not inline) so we can store reference for later removal
      this.popstateHandler = () => {
        this.currentPath = window.location.pathname;
      };

      // Add listener with stored handler reference
      window.addEventListener('popstate', this.popstateHandler);
    }
  }

  // Runs when component is removed from DOM - cleanup to prevent memory leaks
  disconnectedCallback() {
    if (typeof window !== 'undefined' && this.popstateHandler) {
      // Remove listener using same function reference that was added
      window.removeEventListener('popstate', this.popstateHandler);
    }
  }

  // Check if given path matches current page
  // Uses startsWith with trailing slash to avoid false positives
  // e.g., /overview will NOT match /overview/controls
  isCurrentPage(path: string): boolean {
    const pathWithSlash = `${path}/`;
    return (
      this.currentPath === path || this.currentPath.startsWith(pathWithSlash)
    );
  }

  // Handle click navigation without page reload (SPA behavior)
  navigateTo(path: string, e: Event) {
    e.preventDefault(); // Stop default link behavior (prevents page reload)
    window.history.pushState({}, '', `/trust-center${path}`); // Update URL bar

    // Emit custom event instead of relying on React Router's popstate listener
    // Parent component (React host) is responsible for handling navigation
    this.currentPath = window.location.pathname;

    // Dispatch custom event that parent can listen for
    const event = new CustomEvent('aonNavigate', {
      detail: { path: `/trust-center${path}` },
      bubbles: true,
      composed: true // allows event to cross Shadow DOM boundary
    });
    window.dispatchEvent(event);
  }
  render() {
    return (
      <Host>
        <nav class="navbar">
          {/* Overview link - dynamically add 'active' class if on this page */}
          <a
            href="/trust-center/overview"
            class={`nav-item ${this.isCurrentPage('/overview') ? 'active' : ''}`}
            onClick={e => this.navigateTo('/overview', e)}
          >
            OVERVIEW
          </a>

          {/* Controls link */}
          <a
            href="/trust-center/controls"
            class={`nav-item ${this.isCurrentPage('/controls') ? 'active' : ''}`}
            onClick={e => this.navigateTo('/controls', e)}
          >
            CONTROLS
          </a>

          {/* Resources link */}
          <a
            href="/trust-center/resources"
            class={`nav-item ${this.isCurrentPage('/resources') ? 'active' : ''}`}
            onClick={e => this.navigateTo('/resources', e)}
          >
            RESOURCES
          </a>

          {/* FAQ link */}
          <a
            href="/trust-center/faqs"
            class={`nav-item ${this.isCurrentPage('/faqs') ? 'active' : ''}`}
            onClick={e => this.navigateTo('/faqs', e)}
          >
            FAQ
          </a>
        </nav>
      </Host>
    );
  }
}
