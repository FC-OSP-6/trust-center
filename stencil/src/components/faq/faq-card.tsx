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

import { Component, Prop, h, Event, EventEmitter, State } from '@stencil/core';

//h - bridge between JSX syntax and runtime
//Stencil Virtual Dom

//When rendering components, h transforms divs into functions that render

//Component - self explanatory
//Props - self explanatory
//

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

  //We want a boolean of true or false to control the "expanded prop"
  /** Controlled expanded state from host */
  @State() isExpanded: boolean = false;
  @Prop() expanded!: boolean;

  //We want an event listener for when the expand & collapse button is clicked.

   /** Emitted when the expand/collapse button is clicked */
  @Event() toggle!: EventEmitter<void>;

  //const [isExpanded, setIsExpanded] = useState(false);
private handleToggle = (): void => {
  this.isExpanded = !this.isExpanded;
}

  render() {
    const { question, answer, expanded } = this;
    console.log('Rendering FAQ:', { question, expanded }); // Check if expanded toggles

    // This will log to the browser console when the component is about to load
    console.log('Component is about to load. Name:', this);
    
    return (
       <div class={`faq-card ${this.isExpanded ? 'is-expanded' : ''}`}>
        { /* 
          Header Section
          - Clickable area that triggers toggle
          - Contains question text and expand/collapse icon
          - role="button" makes it accessible as interactive element
        */ }
        <header class="faq-header"
        onClick={this.handleToggle}
        aria-epanded={this.isExpanded ? 'true' : 'false'}
        aria-controls="faq-content">
          <span class="faq-question">{this.question}</span>
          {/* 
            Chevron icon rotates based on state
            Unicode character for down arrow
          */}
           <button class="expand-toggle" onClick={() => this.toggle.emit()}>

          <button class="state-toggle" onClick={() => this.data}>
          {expanded ? '−' : '+'}
  </button>
        </header>


        {expanded && (
          <p class="faq-answer">
          {answer}
        </p>
        )}
      </div>
    );
  }
}



