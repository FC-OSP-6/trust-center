/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  ambient declarations for client-side non-ts imports

  - fixes ts(2307) for imported assets (.svg/.pdf/etc.)
  - fixes ts(7016) for stencil loader imports
  - must remain a .d.ts file with ambient declarations only
  - do not add runtime code here
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

// ----------  bundled static assets (vite resolves imports to url strings)  ----------

declare module '*.png' {
  const src: string; // vite emits a public url string for imported asset
  export default src; // default export matches `import logo from "...png"`
}

declare module '*.svg' {
  const src: string; // vite emits a public url string for imported svg
  export default src; // default export matches client usage
}

declare module '*.jpeg' {
  const src: string; // vite emits a public url string for imported jpeg
  export default src; // default export matches client usage
}

declare module '*.jpg' {
  const src: string; // vite emits a public url string for imported jpg
  export default src; // default export matches client usage
}

declare module '*.pdf' {
  const src: string; // vite emits a public url string for imported pdf
  export default src; // default export matches client usage
}

// ----------  stencil loader typings (support both import styles during refactors)  ----------

declare module '../../stencil/loader' {
  export function defineCustomElements(
    win?: Window,
    opts?: unknown
  ): Promise<void>; // stencil loader returns a promise (safe to ignore with void)
}

declare module '../../stencil/loader/index.es2017.js' {
  export function defineCustomElements(
    win?: Window,
    opts?: unknown
  ): Promise<void>; // compatibility for older import path still found on some branches
}
