/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  CyQu AI assistant card (shadow-dom)

  - stencil owns all visual presentation: card, textarea, buttons, response states
  - react owns: status, answer data, api calls, lastSubmitted for retry
  - internal state: isOpen (disclosure panel), textareaValue (controlled internally)
  - emits events so react can drive the data layer without direct dom access
  - implements disclosure pattern per spec.md accessibility requirements
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import {
  Component,
  Prop,
  State,
  Watch,
  Element,
  Event as StencilEvent,
  EventEmitter,
  h
} from '@stencil/core';

// ---------- local types (mirrors AiAnswerUi / AiCitationUi from types-frontend) ----------

type CitationUi = {
  id: string;
  label: string;
  kind: string;
  category?: string;
};

type AnswerUi = {
  answer: string;
  citations: CitationUi[];
  provider: string;
  mode: string;
  status: string;
  fallbackUsed?: boolean;
  error?: string | null;
};

type AiSubmitDetail = {
  question: string; // trimmed question text emitted on submit
};

// ---------- immutable copy (spec.md §UX Copy — do not paraphrase) ----------

const COPY = {
  title: 'CyQu Assistant',
  helper:
    'Ask about controls, FAQs, or resources. Answers include source-backed references.',
  label: 'Ask a Trust Center question',
  placeholder:
    'For example: Explain MFA controls, summarize incident response FAQs...',
  loading: 'Searching Trust Center content and preparing an answer\u2026',
  error: 'The assistant could not complete that request. Please try again.',
  fallback:
    'This answer may be based on general knowledge rather than live Trust Center data.'
} as const;

@Component({
  tag: 'aon-ai-assistant',
  styleUrl: './ai-assistant.css',
  shadow: true
})
export class AonAiAssistant {
  @Element() host!: HTMLElement;

  // ---------- props from react ----------

  @Prop() status: string = 'idle'; // AiUiStatus: idle | submitting | success | fallback | error
  @Prop() answerJson: string = ''; // serialized AiAnswerUi or empty string

  // ---------- internal state (owned by stencil — visual concerns) ----------

  @State() isOpen: boolean = false; // disclosure panel visibility
  @State() textareaValue: string = ''; // controlled textarea value

  // ---------- events to react ----------

  @StencilEvent({ eventName: 'aonAiSubmit', bubbles: true, composed: true })
  aiSubmit!: EventEmitter<AiSubmitDetail>; // react calls askAi with question

  @StencilEvent({ eventName: 'aonAiRetry', bubbles: true, composed: true })
  aiRetry!: EventEmitter<void>; // react retries with lastSubmitted

  @StencilEvent({ eventName: 'aonAiClear', bubbles: true, composed: true })
  aiClear!: EventEmitter<void>; // react resets status + answer

  // ---------- internal element refs ----------

  private triggerEl?: HTMLButtonElement;
  private textareaEl?: HTMLTextAreaElement;

  // ---------- parsed answer cache ----------

  private parsedAnswer: AnswerUi | null = null;

  // ---------- lifecycle ----------

  componentWillLoad() {
    this.parseAnswer(this.answerJson);
  }

  // ---------- watchers ----------

  @Watch('answerJson')
  onAnswerJsonChange(next: string) {
    this.parseAnswer(next);
  }

  // ---------- helpers ----------

  private parseAnswer(raw: string) {
    const text = (raw ?? '').trim();

    if (!text) {
      this.parsedAnswer = null;
      return;
    }

    try {
      this.parsedAnswer = JSON.parse(text) as AnswerUi;
    } catch {
      this.parsedAnswer = null;
    }
  }

  // ---------- interaction handlers ----------

  private handleToggle() {
    const opening = !this.isOpen;

    this.isOpen = opening;

    if (opening) {
      requestAnimationFrame(() => {
        this.textareaEl?.focus(); // spec: open → focus textarea
      });
    } else {
      this.triggerEl?.focus(); // spec: close → return focus to trigger
    }
  }

  private handleInput(e: Event) {
    this.textareaValue = (e.target as HTMLTextAreaElement).value;
  }

  private handleSubmit() {
    const trimmed = this.textareaValue.trim();

    if (!trimmed) return; // spec: reject empty input
    if (this.status === 'submitting') return; // spec: prevent duplicate submissions

    this.aiSubmit.emit({ question: trimmed });
  }

  private handleRetry() {
    if (this.status === 'submitting') return; // spec: prevent duplicate submissions

    this.aiRetry.emit();
  }

  private handleClear() {
    this.isOpen = false; // spec: clear resets panel state
    this.textareaValue = '';
    this.aiClear.emit();

    requestAnimationFrame(() => {
      this.triggerEl?.focus(); // spec: clear → return focus to trigger
    });
  }

  // ---------- render ----------

  render() {
    const status = (this.status ?? 'idle') as string;
    const isSubmitting = status === 'submitting';
    const askDisabled = this.textareaValue.trim() === '' || isSubmitting;

    // spec: showRetry only in terminal error states
    const showRetry = status === 'error' || status === 'fallback';

    // spec: showClear once there is something to clear (not idle or submitting)
    const showClear = status !== 'idle' && status !== 'submitting';

    const answer = this.parsedAnswer;
    const showAnswer =
      (status === 'success' || status === 'fallback') && answer !== null;

    return (
      <section class="ai-assistant" aria-label={COPY.title}>
        <div class="ai-header">
          <h3 class="ai-title">{COPY.title}</h3>

          <p class="ai-helper">{COPY.helper}</p>
        </div>

        <button
          class="ai-trigger"
          type="button"
          aria-expanded={this.isOpen ? 'true' : 'false'}
          aria-controls="ai-panel"
          onClick={() => this.handleToggle()}
          ref={el => {
            this.triggerEl = el;
          }}
        >
          Ask a question
        </button>

        <div
          id="ai-panel"
          class={{ 'ai-panel': true, 'ai-panel--open': this.isOpen }}
          hidden={!this.isOpen}
        >
          <div class="ai-panel-inner">
            <label class="ai-label" htmlFor="ai-textarea">
              {COPY.label}
            </label>

            <textarea
              id="ai-textarea"
              class="ai-textarea"
              placeholder={COPY.placeholder}
              rows={4}
              value={this.textareaValue}
              onInput={e => this.handleInput(e)}
              ref={el => {
                this.textareaEl = el as HTMLTextAreaElement | undefined;
              }}
            />

            <div class="ai-actions">
              <button
                type="button"
                class={{
                  'ai-btn': true,
                  'ai-btn--submit': true,
                  'ai-btn--disabled': askDisabled
                }}
                disabled={askDisabled}
                onClick={() => this.handleSubmit()}
              >
                {isSubmitting ? COPY.loading : 'Ask'}
              </button>

              {showRetry && (
                <button
                  type="button"
                  class="ai-btn ai-btn--retry"
                  onClick={() => this.handleRetry()}
                >
                  Retry
                </button>
              )}

              {showClear && (
                <button
                  type="button"
                  class="ai-btn ai-btn--clear"
                  onClick={() => this.handleClear()}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div
            class="ai-response"
            aria-live="polite"
            aria-atomic="true"
            data-status={status}
          >
            {isSubmitting && <p class="ai-loading">{COPY.loading}</p>}

            {status === 'error' && (
              <div class="ai-error" role="alert">
                <p>{COPY.error}</p>
              </div>
            )}

            {showAnswer && (
              <div
                class={{
                  'ai-answer': true,
                  'ai-answer--fallback': status === 'fallback'
                }}
              >
                <p class="ai-answer-text">{answer!.answer}</p>

                {status === 'fallback' && (
                  <p class="ai-fallback-notice">{COPY.fallback}</p>
                )}

                {answer!.citations.length > 0 && (
                  <ul class="ai-citations" aria-label="Sources">
                    {answer!.citations.map(c => (
                      <li key={c.id} class="ai-citation">
                        <span class="ai-citation-label">{c.label}</span>

                        <span class="ai-citation-kind">{c.kind}</span>

                        {c.category && (
                          <span class="ai-citation-category">{c.category}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }
}
