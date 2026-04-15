# Feature Specification (Reusable Template)

## 🎯 Objective

Define a **bounded, production-ready feature** with clear constraints, ownership, and behavior.

This document is the **source of truth** for implementation.

---

## 📍 Feature Definition

### Name

CyQu Assistant (AI Rail Assistant)

### Type

Contextual UI component (NOT a global system)

### Purpose

Provide **source-backed answers** within the Trust Center context.

---

## 🧱 Architectural Constraints (Non-Negotiable)

### Ownership

- UI: React
- Design system: existing token layer
- Data: API helper layer

### Placement

- Lives only within predefined container (InfoRail)
- No new routes
- No global UI elements (e.g. floating buttons)

### Interaction Model

- Single-exchange (no history)
- No streaming
- No markdown rendering

---

## 🚫 Explicit Non-Goals

- Chat transcript UI
- Multi-turn conversations
- Provider selection UI
- Real-time streaming responses
- Deep-link navigation from citations

---

## 🧬 Data Contract

```typescript
export type AiUiStatus =
  | 'idle'
  | 'submitting'
  | 'success'
  | 'fallback'
  | 'error';

export type AiCitationUi = {
  id: string;
  label: string;
  kind: 'control' | 'faq' | 'resource';
  category?: string;
};

export type AiAnswerUi = {
  answer: string;
  citations: AiCitationUi[];
  provider: string;
  mode: 'online' | 'offline';
  status: 'success' | 'fallback' | 'error';
  error?: string | null;
  fallbackUsed?: boolean;
};
```

### Mapping Rules (Critical)

- backend `success` → UI `success`
- backend `fallback` OR `fallbackUsed === true` → UI `fallback`
- network / unexpected failure → UI `error`

---

## ⚙️ State Machine

### Allowed States

- idle
- submitting
- success
- fallback
- error

### Rules

- No additional states allowed
- No state aliasing (e.g. “loading” instead of “submitting”)

---

## 🧠 Behavioral Rules

### Input

- Trim before submit
- Reject empty input
- Preserve value after response

### Submission

- One request at a time
- Disable duplicate submissions

### Retry

- Uses last submitted input
- Does not require retyping

### Clear

- Resets entire component state, including closing the disclosure panel (`isOpen` → false)

---

## ♿ Accessibility Requirements

- Disclosure pattern (NOT modal)
- Required attributes:
  - aria-expanded
  - aria-controls
  - aria-live="polite"

- role="alert" ONLY for technical errors

### Focus Behavior

- Open → focus textarea
- Close → return focus to trigger

---

## 🎨 UI & Styling Rules

- Use existing design tokens ONLY
- No hardcoded colors
- No new design primitives

### Layout Constraints

- Must coexist with sticky rail
- Must not expand indefinitely
- Must support internal scrolling

---

## 🧵 UX Copy (Immutable)

These strings must be used exactly as defined.

- Title: CyQu Assistant
- Helper: Ask about controls, FAQs, or resources. Answers include source-backed references.
- Label: Ask a Trust Center question
- Placeholder: For example: Explain MFA controls, summarize incident response FAQs...
- Loading: Searching Trust Center content and preparing an answer…
- Error: The assistant could not complete that request. Please try again.

---

## 🔍 Observability (Implicit Requirement)

The system must allow:

- Clear differentiation between fallback and error
- Visibility into response source (citations)
- Reproducible UI states for QA

---

## ✅ Acceptance Criteria

- Feature renders only in allowed locations
- All 5 states are reachable and distinct
- No contract violations
- No UI pattern violations
- No regression to surrounding layout

---

## 🧠 Guiding Principle

> This is a **contextual answer tool**, not a chatbot.

All implementation decisions must reinforce:

- clarity over cleverness
- constraint over flexibility
- trust over novelty
