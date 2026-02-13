/* ================================
  TL;DR  -->  lists the categories of all control cards on the controls page

  - renders a small "subnav" card with anchor links
  - links are meant to jump down the page via fragment ids (ex: #infrastructure-security)
  - each target section on the page must have a matching id attribute
================================ */

import { Component, Prop, h } from "@stencil/core"; // stencil decorators for defining a web component + its public api
// `h` is stencil’s jsx factory; jsx compiles to h('tag', ...) calls at build time

@Component({
  tag: "aon-subnav-card", // registers the custom element <aon-subnav-card>
  styleUrls: ["./subnav-card.css"], // component-local stylesheet
  shadow: true, // enables shadow dom for dom + style encapsulation
})
export class AonSubnavCard {
  @Prop() subnavCardTitle: string = "Categories"; // visible heading for the subnav card

  @Prop() infrastructureSecurityHref: string = "#infrastructure-security"; // fragment id for infrastructure section
  @Prop() organizationalSecurityHref: string = "#organizational-security"; // fragment id for organizational section
  @Prop() productSecurityHref: string = "#product-security"; // fragment id for product section
  @Prop() internalSecurityProceduresHref: string = "#internal-security-procedures"; // fragment id for internal procedures section
  @Prop() dataAndPrivacyHref: string = "#data-and-privacy"; // fragment id for data + privacy section

  render() {
    return (
      <div class="subnav-card">
        <div class="subnav-card-title">{this.subnavCardTitle}</div>

        <div class="subnav-card-links">
          <a href={this.infrastructureSecurityHref}>Infrastructure Security</a>
          <a href={this.organizationalSecurityHref}>Organizational Security</a>
          <a href={this.productSecurityHref}>Product Security</a>
          <a href={this.internalSecurityProceduresHref}>Internal Security Procedures</a>
          <a href={this.dataAndPrivacyHref}>Data and Privacy</a>
        </div>
      </div>
    );
  }
}
