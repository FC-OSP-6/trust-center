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
  // @Prop() loginIcon!: string;

  render() {
    return (
      <div>
        <header class="header">
          <div class="product-title">
            <h1 class="product-title-text">CyQu</h1>
          </div>
          <div class="login-container">
            <div class ="login-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M240 192C240 147.8 275.8 112 320 112C364.2 112 400 147.8 400 192C400 236.2 364.2 272 320 272C275.8 272 240 236.2 240 192zM448 192C448 121.3 390.7 64 320 64C249.3 64 192 121.3 192 192C192 262.7 249.3 320 320 320C390.7 320 448 262.7 448 192zM144 544C144 473.3 201.3 416 272 416L368 416C438.7 416 496 473.3 496 544L496 552C496 565.3 506.7 576 520 576C533.3 576 544 565.3 544 552L544 544C544 446.8 465.2 368 368 368L272 368C174.8 368 96 446.8 96 544L96 552C96 565.3 106.7 576 120 576C133.3 576 144 565.3 144 552L144 544z" fill="gray"/></svg>
            </div>
          </div>
        </header>
      </div>
  
    


      
      
    );
  }
}

