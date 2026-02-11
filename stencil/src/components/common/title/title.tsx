/* ================================
  TL;DR  --> The section containing the `Trust Center` title
      1. Also has informaton for extra support and their email link
================================ */

import { Component, Prop, h } from '@stencil/core'; // Imports Stencil decorators for defining a Web Component and its public API
// `h` is Stencil’s JSX factory; JSX elements compile to h('tag', ...) calls at build time

// Defines the <aon-title> Web Component
@Component({
  tag: 'aon-title', // registers the custom element <aon-title>
  styleUrls: ['./title.css'], 
  shadow: true, // enables Shadow DOM for DOM and style encapsulation
})

 
export class AonTitle {

 @Prop() trustCenterName: string = "Trust Center";
 @Prop() supportMessage = "Resources to address common cyber security questions from clients";
 @Prop() supportEmail: string = "cyber.security.support@email.com";

  render() {
    return (
      <div class="title-section">
       <div class="name">
        <h1>{this.trustCenterName}</h1>
      </div>
        <div class="support-message">
          <p>{this.supportMessage}</p>
        </div>
        <div class="support-email">
          <a href={this.supportEmail}></a>
        </div>
      </div>
    );
  }
}

