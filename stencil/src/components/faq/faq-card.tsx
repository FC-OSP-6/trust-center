/* ======================================================
  TL;DR → Expandable FAQ card

  Responsibilities:
  - Render a single FAQ item (question + answer)
  - Display an expand / collapse affordance (+ / −)
  - Conditionally render the answer content
  - Manage expansion state locally for now (we can switch to host-controlled React state after the build is stable)

  Data contract:
  - `question`: string displayed as the FAQ prompt
  - `answer`: string body text revealed on expansion
  - `expanded`: optional controlled boolean provided by host (not used yet in this implementation)
====================================================== */

import { Component, Prop, h, Event, EventEmitter, State } from '@stencil/core';

// h - bridge between JSX syntax and runtime
// stencil virtual dom

// when rendering components, h transforms divs into functions that render

// component - self explanatory
// props - self explanatory
//

@Component({
  tag: 'aon-faq-card',
  styleUrl: 'faq-card.css',
  shadow: true
})
export class FaqCard {
  /** FAQ prompt text */
  @Prop() question!: string;

  /** Answer content */
  @Prop() answer!: string;

  // we want a boolean of true or false to control the "expanded" state
  /** internal expanded state (local ui state) */
  @State() isExpanded: boolean = false;

  /** controlled expanded state from host (react) (reserved for later; currently not used) */
  @Prop() expanded!: boolean;

  // we want an event listener for when the expand & collapse button is clicked.

  /** emitted when the expand/collapse action happens (host can listen if needed) */
  @Event() toggle!: EventEmitter<void>;

  // const [isExpanded, setIsExpanded] = useState(false);
  private handleToggle = (): void => {
    this.isExpanded = !this.isExpanded;
  };

  render() {
    const { question, answer } = this;

    // this will log to the browser console every render so we can see state changes
    console.log('Rendering FAQ:', { question, isExpanded: this.isExpanded });
    // REVIEW: Remove console.log in render – causes noise in production and can leak data.

    // this will log to the browser console when the component instance exists
    console.log('Component instance:', this);
    // REVIEW: Remove console.log('Component instance:', this) – same as above.

    return (
      <div class={`faq-card ${this.isExpanded ? 'is-expanded' : ''}`}>
        {/*
          header section
          - clickable area that triggers toggle
          - contains question text and expand/collapse icon
          - role="button" makes it accessible as interactive element (we keep native semantics via the <button> too)
        */}
        {/* REVIEW: <header> with onClick is not keyboard-accessible – add tabIndex={0} and onKeyDown (e.g. Enter/Space to toggle) or make the entire toggle a single <button> that wraps question + icon. */}
        <header
          class="faq-header"
          onClick={this.handleToggle}
          aria-expanded={this.isExpanded ? 'true' : 'false'}
          aria-controls="faq-content"
        >
          <span class="faq-question">{this.question}</span>

          {/*
            chevron / state icon
            - uses a single button (no nested buttons) to avoid invalid html
            - stopPropagation prevents the header onClick from double-toggling
          */}
          <button
            class="state-toggle"
            type="button"
            onClick={e => {
              e.stopPropagation();
              this.handleToggle();
              this.toggle.emit();
            }}
            aria-label={this.isExpanded ? 'collapse answer' : 'expand answer'}
          >
            {this.isExpanded ? '−' : '+'}
          </button>
          {/* REVIEW: Both header onClick and button onClick call handleToggle – button correctly uses stopPropagation, but double handler is easy to break; consider single toggle on the button and remove header onClick, or document that header is the click target. */}
        </header>

        {this.isExpanded && (
          <p class="faq-answer" id="faq-content">
            {answer}
          </p>
        )}
      </div>
    );
  }
}
