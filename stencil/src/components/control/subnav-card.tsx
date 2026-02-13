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

  @Prop() subnavCardTitle: string = "Categories";
  @Prop() infrastructureSecurityHref: string = "Infrastructure Security";
  @Prop() organizationalSecurityHref: string = "Organizational Security";
  @Prop() productSecurityHref: string = "Product Security";
  @Prop() internalSecurityProceduresHref: string = "Internal Security Procedures";
  @Prop() dataAndPrivacyHref: string = "Data and Privacy";
  

  

  
  render() {
    return (
       <div class="subnav-card">
      <h5 class="subnav-card-title">{this.subnavCardTitle}</h5>
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