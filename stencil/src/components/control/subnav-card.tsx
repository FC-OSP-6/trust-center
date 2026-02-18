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