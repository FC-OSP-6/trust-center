/* ======================================================
  TL;DR → Expandable FAQ card

  Responsibilities:
  - Render a single FAQ item (question + answer)
  - Display an expand / collapse affordance (+ / −)
  - Conditionally render the answer content
  - Delegate expansion state ownership to the host framework (React)

  Data contract:
  - `question`: string displayed as the FAQ prompt
  - `answer`: string body text revealed on expansion
  - `expanded`: controlled boolean provided by host
====================================================== */

import { Component, Prop, Event, EventEmitter, h } from '@stencil/core';
// Stencil core decorators + JSX factory
// Component is fully controlled; no internal state is used

@Component({
  tag: 'faq-card',
  styleUrl: 'faq-card.css',
  shadow: true, // isolate DOM + styles for design-system safety
})
export class FaqCard {
  // ---- Public API (controlled by host application) ----

  /** FAQ prompt text */
  @Prop() question!: string;

  /** Answer content displayed when expanded */
  @Prop() answer!: string;

  /** Controlled expansion state (owned by React) */
  @Prop() expanded = false;

  /** User intent: toggle expand / collapse */
  @Event() toggleFaq!: EventEmitter<void>;

  // ---- Event handlers ----
  // Emits intent only; no internal state mutation

  private onToggle = () => {
    this.toggleFaq.emit();
  };

  // ---- Render ----
  // Renders UI based solely on provided props

  render() {
    const { question, answer, expanded } = this;

    return (
      <div class="faq-card">
        {/* Header row: question text + expand affordance */}
        <header class="faq-header">
          <h1>{question}</h1>

          <button
            class="toggle"
            type="button"
            aria-expanded={expanded.toString()}
            aria-label={expanded ? 'Collapse answer' : 'Expand answer'}
            onClick={this.onToggle}
          >
            {expanded ? '−' : '+'}
          </button>
        </header>

        {/* Answer content rendered only when expanded */}
        {expanded && (
          <p class="faq-answer">
            {answer}
          </p>
        )}
      </div>
    );
  }
}



