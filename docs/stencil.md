# Stencil

## Scope

The `stencil` workspace is the component system for the Trust Center prototype. It is not a second application. It compiles reusable custom elements that React consumes as part of the Trust Center UI.

## Design System Philosophy

The Stencil layer exists to provide:

- reusable presentation primitives
- token-based styling
- shadow-DOM encapsulation
- framework-agnostic components that can outlive a single frontend framework choice

This is a meaningful architectural choice for a client-facing prototype. It demonstrates that the visual system can remain portable even while the app shell is React-based.

## Current Component Architecture

Primary component groups:

### Layout

- `aon-header`
- `aon-title`
- `aon-navbar`
- `aon-footer`
- `aon-theme-toggle`

### Controls and navigation

- `aon-control-card`
- `aon-subnav-card`

### FAQs

- `aon-faq-card`

### Overview and shared cards

- `aon-expansion-card`
- `aon-blue-card`
- `aon-link-card`

Each component is prop-driven. The components do not fetch their own data. React owns data retrieval and passes serialized content into the component layer.

## Token Structure

The shared style system lives under `stencil/src/components/styles/`.

Important files:

- `tokens.css`
- `tokens-semantic.css`
- `tokens-dark.css`
- `typography.css`
- `global.css`
- `expandable.css`

This structure separates:

- raw tokens
- semantic mappings
- dark-mode-specific overrides
- typography rules
- reusable interaction patterns

That is stronger than ad hoc component-local styling because it gives the system a maintainable basis for theme work and cross-component consistency.

## Shadow DOM Decisions

The components use shadow DOM to encapsulate internal markup and styles.

Benefits in this implementation:

- layout and card styles remain isolated
- design-system changes are easier to localize
- the React layer can treat custom elements as stable render targets

Tradeoffs in this implementation:

- section navigation into component internals requires explicit shadow-root access
- route-level deep-link behavior becomes more complex than in a light-DOM-only app
- debugging UI behavior may require inspecting both the host element and shadow tree

The current repository has already accounted for those tradeoffs in the React bridge layer.

## How React consumes Stencil

The integration model is direct:

- React renders Stencil custom elements in TSX
- `types-frontend.ts` augments JSX intrinsic types
- React passes JSON strings for richer data payloads
- Stencil parses and validates incoming JSON payloads
- Stencil emits custom events such as `tc-theme-change` and subnav jump events
- React listens and coordinates route-level or document-level side effects

This is a pragmatic custom-element integration pattern. It keeps the component system framework-agnostic while still allowing the app shell to own application concerns.

## Naming Conventions

Component tags follow kebab-case custom-element naming such as:

- `aon-navbar`
- `aon-control-card`
- `aon-theme-toggle`

This is the expected browser-native custom-element style and keeps the Stencil layer aligned with platform conventions.

## Design Highlights

- Stencil is used where it adds architectural value: shared UI, tokens, encapsulation, and portability.
- React does not depend on framework-specific wrappers to consume the component layer.
- Theme behavior is coordinated at the system level rather than trapped in a single component.
- Component data flow is one-way and explicit, which reduces hidden state.

## Tradeoffs

### Stencil plus React instead of React-only components

Benefits:

- cleaner design-system boundary
- less framework lock-in
- stronger component encapsulation

Tradeoffs:

- more integration code
- runtime JSON parsing at the boundary
- additional event coordination for shell-level behavior

### Shadow DOM for interactive card components

Benefits:

- consistent encapsulation of styles and internal structure
- fewer accidental styling collisions

Tradeoffs:

- deep linking and DOM-driven navigation are harder
- test selectors and browser debugging can be less straightforward

### Prop-driven components with no internal fetches

Benefits:

- clear ownership of data and UI responsibilities
- easier reuse of components in different shells

Tradeoffs:

- larger payloads may need serialization
- the integration layer must keep payload contracts stable

## Current Challenges

- The more expressive the component payloads become, the more careful the React-Stencil contract has to be.
- Some interactive behaviors, especially subnav jumps into shadow DOM, require special-case bridge code.
- Component-level testing is not yet as mature as the backend test suite.

## Notable Constraints

- The Stencil layer assumes data is provided from React, not fetched internally.
- JSON prop parsing is part of the current component contract.
- The current build outputs support custom-element distribution, but the repo does not yet demonstrate consumption outside the main React shell.
- Theme behavior depends on both the Stencil toggle and the app-level theme state.

## Stretch and Future Work

- Expand component-level tests
- Reduce boundary friction for richer payloads
- Continue unifying interaction patterns across controls, FAQs, and overview cards
- Expose additional reusable component primitives only when they support a real route or product need
