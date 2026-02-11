/* ================================
  TL;DR  -->  Site-level footer Web Component

  - Renders the legal footer section of the Trust Center using a Stencil Web Component.
  - Uses Shadow DOM for DOM and style encapsulation, prioritizing isolation and
    portability over global styling flexibility.
  - Exposes all display content and navigation targets via props to ensure that
    state and business logic remain in the host application (e.g., React).
  - Contains no internal state, events, or side effects; this component is strictly
    presentational.
  - Exports a single custom element (<aon-footer>) intended for use in site-level
    layouts across the Trust Center and related pages.
  - Depends only on Stencil core APIs and local styles; no shared utilities,
    services, or external modules are required.

  TODO: Document architectural decisions and tradeoffs for this component in the README.
================================ */

import { Component, Prop, h, Element } from '@stencil/core'; // Imports Stencil decorators for defining a Web Component and its public API
// `h` is Stencil’s JSX factory; JSX elements compile to h('tag', ...) calls at build time

// Defines the <aon-footer> Web Component
@Component({
  tag: 'aon-footer', // registers the custom element <aon-footer>
  // styleUrls: ['./footer.css','../global-stencil.css'], // associates component-scoped styles at build time
  styleUrl: 'footer.css', // this is the new name of our global css file
  shadow: true, // enables Shadow DOM for DOM and style encapsulation
})
export class AonFooter {
  // Web Component definition and render logic for <aon-footer>

  // Public, read-only props with default values; intended to be overridden by the parent application (e.g., React)
  @Prop() copyright: string = '© Aon plc'; // TODO: Move year generation to the React layer and pass the computed value as a prop
  @Prop() privacyPolicyHref: string = '/privacy-policy';
  @Prop() termsHref: string = '/terms-and-conditions';
  @Prop() logoSrc!: string;
  @Element() el: HTMLElement;

  componentDidLoad() {
    const elementInShadowDom =
      this.el.shadowRoot.querySelector('.footer-links');
  }

  //FAQS & CONTROLS -- would change

  //
  render() {
    const { copyright, privacyPolicyHref, termsHref, logoSrc } = this; // Destructure component props for cleaner JSX usage
    return (
      <footer role="contentinfo">
        {/* ARIA landmark identifying site-level informational content for accessibility tools */}
        <div class="footer-content">
          <div class="footer-logo">
            <img src={logoSrc} alt="Company logo" />
          </div>
          <div class="footer-links p-xs">
            <a href={privacyPolicyHref}>Privacy Policy</a>
            <a href={termsHref}>Terms and Conditions</a>
          </div>
          <div class="footer-copyright">
            <p>{copyright}</p>
            {/*  */}
          </div>
        </div>
      </footer>
    );
  }
}
