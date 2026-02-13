/* ================================
  TL;DR  -->  lists the categories of all control cards on the controls page
      1. links down the page to each control card
================================ */

import { Component, Prop, h } from '@stencil/core'; // Imports Stencil decorators for defining a Web Component and its public API
// `h` is Stencil’s JSX factory; JSX elements compile to h('tag', ...) calls at build time


// Defines the <aon-subnav-card> Web Component
@Component({
  tag: 'aon-subnav-card', // registers the custom element <aon-subnav-card>
  styleUrls: ['./subnav-card.css'], 
  shadow: true, // enables Shadow DOM for DOM and style encapsulation
})

export class AonSubnavCard {

  // @Prop() subnavCardTitle: string = "Categories";
  @Prop() infrastructureSecurityHref: string = "Infrastructure Security";
  @Prop() organizationalSecurityHref: string = "Organizational Security";
  @Prop() productSecurityHref: string = "Product Security";
  @Prop() internalSecurityProceduresHref: string = "Internal Security Procedures";
  @Prop() dataAndPrivacyHref: string = "Data and Privacy";
  

  

  
  render() {
    return (
       <div class="subnav-card">
      <div class="subnav-card-title"></div>
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