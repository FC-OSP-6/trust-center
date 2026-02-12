/* ================================
  TL;DR  -->  The blue shaded cards that are on Aon's mockup
      1. These cards should provide a link(contained in a button) for the user to visit
================================ */
import { Component, Prop, h } from '@stencil/core'; // Imports Stencil decorators for defining a Web Component and its public API
// `h` is Stencil’s JSX factory; JSX elements compile to h('tag', ...) calls at build time

@Component({
  tag: 'aon-blue-card', // registers the custom element <aon-footer>
  styleUrls: ['./blue-cards.css'], // this is the new name of our global css file
  shadow: true, // enables Shadow DOM for DOM and style encapsulation
})
export class AonBlueCard {
  // Web Component definition and render logic for <aon-blue-card>

  @Prop() blueCardTitle: string;
  @Prop() blueCardDescription: string;
  @Prop() blueCardButtonText: string;
  @Prop() blueCardButtonLink: string;

  //FAQS & CONTROLS -- would change

  //
  render() {
    const {
      blueCardTitle,
      blueCardDescription,
      blueCardButtonText,
      blueCardButtonLink,
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
            class="blue-card-button-link"
          >
            {blueCardButtonText}
          </a>
        </button>
      </div>
    );
  }
}
