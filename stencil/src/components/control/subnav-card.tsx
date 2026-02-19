/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  In-page section jump navigation card

  - Stateless presentational component; all routing and layout owned by the React host.
  - Shadow DOM encapsulation chosen for style isolation; tradeoff is that global styles
    cannot pierce the shadow boundary without CSS custom properties.
  - All link targets and the card title are configurable via props with default values;
    fragment hrefs assume matching id attributes exist on the host page.

  - Lives in: stencil/components/subnav-card/
  - Depends on: subnav-card.css (component-scoped styles), tokens.css (via CSS custom properties)
  - Exports: <aon-subnav-card> — consumed by the React Controls page to provide
    jump navigation across the five security control category sections.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */


// TODO: Determine optimal placement on controls page

import { Component, Prop, h } from "@stencil/core"; // Imports Stencil decorators and JSX factory for defining the Web Component
// `h` is the JSX factory function used during compilation

@Component({
  tag: "aon-subnav-card", // registers the custom element <aon-subnav-card>
  styleUrls: ["./subnav-card.css"], // component-local stylesheet
  shadow: true, // Enables Shadow DOM for DOM and style encapsulation
})
export class AonSubnavCard {

  // Component props: card title and section link targets for page navigation
  @Prop() subnavCardTitle: string = "Categories";
  @Prop() infrastructureSecurityHref: string = "#infrastructure-security";
  @Prop() organizationalSecurityHref: string = "#organizational-security";
  @Prop() productSecurityHref: string = "#product-security";
  @Prop() internalSecurityProceduresHref: string = "#internal-security-procedures";
  @Prop() dataAndPrivacyHref: string = "#data-and-privacy";
  

  render() {
    return (
       <div class="subnav-card">
          <div class="subnav-card-title">{this.subnavCardTitle}</div>
          <ul class="subnav-card-links">
            <li><a href={this.infrastructureSecurityHref}>Infrastructure Security</a></li>
            <li><a href={this.organizationalSecurityHref}>Organizational Security</a></li>
            <li><a href={this.productSecurityHref}>Product Security</a></li>
            <li><a href={this.internalSecurityProceduresHref}>Internal Security Procedures</a></li>
            <li><a href={this.dataAndPrivacyHref}>Data and Privacy</a></li>
          </ul>
      </div>
    );
  }
}