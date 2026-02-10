/* ================================
  TL;DR  -->  The very top of Aon's mockup page
      1. The far left corner should have `CyQu`
      2. The far right corner should have a menu button which will allow developers access to special developer features
================================ */

import { Component, Prop, h } from '@stencil/core'; // Imports Stencil decorators for defining a Web Component and its public API
// `h` is Stencil’s JSX factory; JSX elements compile to h('tag', ...) calls at build time

// Defines the <aon-header> Web Component
@Component({
  tag: 'aon-header', // registers the custom element <aon-header>
  styleUrl: './header.css', 
  shadow: true, // enables Shadow DOM for DOM and style encapsulation
})
export class AonHeader {
  // Logo URL
  @Prop() CyQuLogo: string;

  // Login icon URL
  @Prop() loginIcon: string;

  render() {
    return (
      <header class="header">
        <div class="cyQuLogo">
          {this.CyQuLogo && <img src={this.CyQuLogo} alt="CyQu Logo" />}
        </div>

        {/* creating space to add little man button for dev login */}
        {this.loginIcon && (
          <div class="login-icon">
            <img src={this.loginIcon} alt="login-icon" />
          </div>
        )}
      </header>
    );
  }
}

