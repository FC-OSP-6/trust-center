/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  Sub-navigation Card Web Component

  - Renders a small card listing control page categories
  - Each category is an anchor link to a fragment ID on the page
  - Target sections must have matching ID attributes
  - Component props allow customization of title and link targets
  - Uses shadow DOM for style encapsulation
  - Intended usage: placed on the controls page for quick navigation
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

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