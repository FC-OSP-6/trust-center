# Implementation Plan (Reusable Template)

## 🎯 Purpose

This plan defines the **execution order, ownership boundaries, and validation gates** for implementing a scoped frontend feature.

This is **not a checklist** — it is a **controlled execution sequence**.

---

## 🧭 Phase 0 — Context Alignment (Required)

- Read `spec.md` fully before writing code
- Identify:
  - Fixed constraints (must NOT change)
  - Variable implementation areas

- Confirm:
  - Where the feature lives
  - What owns state
  - What owns data fetching

🚫 Do NOT start coding before this phase is complete

---

## 🧱 Phase 1 — Contract & Data Layer (Blocker Phase)

**Goal:** Lock all data shapes and API boundaries before UI work

### Tasks

- Define or verify all TypeScript contracts
- Implement API helpers (e.g. `askX(...)`)
- Normalize backend → frontend mapping

### Rules

- No UI components created yet
- No direct API calls inside components
- No contract deviations allowed

### Exit Criteria

- All data structures compile
- API helper returns correct shape
- Contract validation passes review

---

## 🧩 Phase 2 — Placement & Structural UI

**Goal:** Anchor feature in the correct location with minimal UI

### Tasks

- Replace placeholders / mount component
- Establish layout + DOM structure
- Implement visibility pattern (e.g. disclosure, inline, etc.)

### Rules

- No business logic yet
- No API wiring yet
- Focus only on structure + placement

### Exit Criteria

- Feature renders in correct location
- Layout does not break existing UI
- Visibility behavior is correct

---

## ⚙️ Phase 3 — State & Interaction Logic

**Goal:** Implement state machine and user interaction rules

### Tasks

- Add controlled state
- Implement input validation
- Implement submit / retry / clear logic

### Rules

- Use only defined state machine (from spec)
- No additional states unless explicitly allowed
- Prevent duplicate or invalid actions

### Exit Criteria

- All user actions behave correctly
- State transitions are predictable and minimal
- No UI-state drift

---

## 🔌 Phase 4 — Data Integration

**Goal:** Connect UI to API layer safely

### Tasks

- Wire API helper into UI
- Map response → UI state
- Handle success, fallback, and error cases distinctly

### Rules

- No raw backend responses in UI
- No inline fetch calls
- All failures must map to defined UI states

### Exit Criteria

- Data flows correctly end-to-end
- All states render correctly
- No unhandled errors

---

## 🎨 Phase 5 — Rendering & UX Fidelity

**Goal:** Finalize UI presentation and user clarity

### Tasks

- Render all states (idle, loading, success, etc.)
- Add supporting UI (metadata, labels, etc.)
- Ensure visibility of critical information (e.g. citations)

### Rules

- Do not introduce new UX patterns
- Do not hide critical information behind interactions
- Follow spec-defined copy and structure

### Exit Criteria

- UI matches spec exactly
- No ambiguity between states
- Information hierarchy is clear

---

## 🧪 Phase 6 — QA & Verification

**Goal:** Ensure production readiness

### Tasks

- Run defined test scenarios
- Validate edge cases
- Verify across breakpoints

### Rules

- Do not assume correctness — verify
- Test failure states explicitly

### Exit Criteria

- All scenarios pass:
  - success
  - fallback
  - error
  - reset

- No regressions in surrounding UI

---

## ⚠️ Global Rules

- Do NOT reorder phases
- Do NOT skip phases
- Do NOT combine phases
- Each phase must pass review before continuing

---

## 🧠 Key Principle

> Build in this order:
> **Contract → Placement → State → Data → Rendering → QA**

Breaking this order will cause rework.
