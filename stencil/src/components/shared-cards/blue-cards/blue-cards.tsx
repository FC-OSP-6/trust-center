/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  Reusable blue call-to-action card component

  - Defines <aon-blue-card>, a presentational Stencil Web Component.
  - Renders a title, description, and external CTA link via props.
  - Uses Shadow DOM for style and DOM encapsulation (trade-off: isolated styles, but no global CSS inheritance).
  - Contains no internal state, events, or business logic.
  - Exports AonBlueCard class; consumed as <aon-blue-card> in host frameworks (e.g., React layer).
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { Component, Prop, h } from '@stencil/core'; // Imports Stencil decorators for defining a Web Component and its public API
// `h` is Stencil’s JSX factory; JSX elements compile to h('tag', ...) calls at build time

//TODO: Props have no defaults – undefined title/description/buttonText/buttonLink will render as "undefined"; add defaults or document as required.
//TODO: Invalid HTML – <button> must not contain <a>. Use <a href={...} class="blue-card-button" ...> or a button that programmatically navigates (e.g. window.location or router).

@Component({
  tag: 'aon-blue-card', // Registers the custom element <aon-blue-card>
  styleUrl: './blue-cards.css',
  shadow: true // enables Shadow DOM for DOM and style encapsulation
})
export class AonBlueCard {
  // Web Component definition and render logic for <aon-blue-card>

  @Prop() blueCardTitle!: string;
  @Prop() blueCardDescription!: string;
  @Prop() blueCardButtonText!: string;
  @Prop() blueCardButtonLink!: string;

  render() {
    const {
      blueCardTitle,
      blueCardDescription,
      blueCardButtonText,
      blueCardButtonLink
    } = this; // Destructure component props for cleaner JSX usage
    return (
      <div class="blue-card">
        <div class="blue-card-text">
          <h5 class="blue-card-title">{blueCardTitle}</h5>
          <p class="blue-card-description">{blueCardDescription}</p>
        </div>

        <button class="blue-card-button">
          <a
            href={blueCardButtonLink}
            target="_blank"
            rel="noopener noreferrer"
            class="blue-card-button-link"
          >
            {blueCardButtonText}
          </a>
        </button>
      </div>
    );
  }
}
