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

import { Component, Prop, h } from '@stencil/core';

@Component({
  tag: 'aon-faq-card',
  styleUrl: 'faq-card.css',
  shadow: true,
})
export class FaqCard {
  /** FAQ prompt text */
  @Prop() question!: string;

  /** Answer content */
  @Prop() answer!: string;

  render() {
    const { question, answer } = this;

    return (
      <div class="faq-card">
        <header class="faq-header">
          <h1 class="faq-question">{question}</h1>
        </header>

        <p class="faq-answer">
          {answer}
        </p>
      </div>
    );
  }
}



