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

  //Track current URL path for active link highlighting
  @State() currentPath: string = window.location.pathname;

  // Set up listener for browser back/forward buttons
  componentWillLoad() {
    window.addEventListener('popstate', () => {
      this.currentPath = window.location.pathname; // Update active link on navigation
    });
  }
  // TODO: popstate listener is never removed – add componentDidUnload() and removeEventListener('popstate', handler) to avoid leaks when element is disconnected.

  // Check if given path matches current page
  // TODO: currentPath.includes(path) can false-positive (e.g. /overview matches /overview/controls); use path === currentPath or currentPath.startsWith(path) with a trailing slash check depending on route shape.
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
  // TODO: Dispatching popstate to "notify React Router" is brittle – document this contract or prefer a custom event / callback prop so the component doesn't depend on React Router internals.
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
