# Stencil

## Purpose

Implements reusable Web Components for UI consistency.

> ### Entry Points
>
> - stencil/src/index.ts
> - Component definitions under stencil/src/components

### Internal Structure

- Component directories.
- CSS token imports.
- Global styles.
- Theme toggle component.
- Dark token definitions.

### Key Implementation Details

- Shadow DOM encapsulation.
- Token-based styling.
- Semantic token layer.
- Dark mode token overrides.
- React integration via compiled output.

### Notable Constraints

- Requires build step before React consumption.
- Styling strictly token-driven.
