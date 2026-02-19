/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  Trust Center page title and support section

  - Stateless presentational component; all layout and positioning owned by the React host.
  - Shadow DOM encapsulation chosen for style isolation; tradeoff is that global styles
    cannot pierce the shadow boundary without CSS custom properties.
  - All props ship with hardcoded defaults, making the component functional without host
    configuration; tradeoff is that defaults must be kept in sync with actual business content.

  - Lives in: stencil/components/title/
  - Depends on: title.css (component-scoped styles), tokens.css (via CSS custom properties)
  - Exports: <aon-title> — consumed by the React host as the intro/hero section
    at the top of the Trust Center page, above the navbar.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { Component, Prop, h } from '@stencil/core'; // Imports Stencil decorators for defining a Web Component and its public API
// `h` is Stencil’s JSX factory; JSX elements compile to h('tag', ...) calls at build time

// Defines the <aon-title> Web Component
@Component({
  tag: 'aon-title', // registers the custom element <aon-title>
  styleUrls: ['./title.css'],
  // REVIEW: Use styleUrl: 'title.css' for consistency (other components use styleUrl, not styleUrls).
  shadow: true // enables Shadow DOM for DOM and style encapsulation
})
export class AonTitle {
  @Prop() trustCenterName: string = 'Trust Center';
  @Prop() supportMessage =
    'Resources to address common cyber security questions from clients.';
  @Prop() supportEmail: string = 'cyber.security.support@email.com';
  @Prop() supportEmailLink: string =
    'mailto:cyber.security.support@email.com?subject=Trust-Center-Support';
  // REVIEW: supportEmail and supportEmailLink duplicate the same default – derive one from the other or accept a single prop to avoid drift.

  render() {
    const { trustCenterName, supportMessage, supportEmail, supportEmailLink } =
      this; // Destructure component props for cleaner JSX usage
    return (
      <div class="title-section">
        <div class="name">
          <h1>{trustCenterName}</h1>
        </div>
        <div class="support-message">
          <p>{supportMessage}</p>
        </div>
        <div class="support-email">
          <a href={supportEmailLink}>{supportEmail}</a>
        </div>
      </div>
    );
  }
}
