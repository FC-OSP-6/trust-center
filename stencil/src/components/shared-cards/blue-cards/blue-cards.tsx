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

@Component({
  tag: 'aon-blue-card', // Registers the custom element <aon-blue-card>
  styleUrls: ['./blue-cards.css'],
  // REVIEW: Use styleUrl: 'blue-cards.css' for consistency with other components.
  shadow: true // enables Shadow DOM for DOM and style encapsulation
})
export class AonBlueCard {
  // Web Component definition and render logic for <aon-blue-card>

  @Prop() blueCardTitle: string;
  @Prop() blueCardDescription: string;
  @Prop() blueCardButtonText: string;
  @Prop() blueCardButtonLink: string;
  // REVIEW: Props have no defaults – undefined title/description/buttonText/buttonLink will render as "undefined"; add defaults or document as required.

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

        {/* REVIEW: Invalid HTML – <button> must not contain <a>. Use <a href={...} class="blue-card-button" ...> or a button that programmatically navigates (e.g. window.location or router). */}
        <button class="blue-card-button">
          <a
            href={blueCardButtonLink}
            target="_blank"
            class="blue-card-button-link"
          >
            {/* REVIEW: target="_blank" without rel="noopener noreferrer" is a security risk – add rel="noopener noreferrer". */}
            {blueCardButtonText}
          </a>
        </button>
      </div>
    );
  }
}
