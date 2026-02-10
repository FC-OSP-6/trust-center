/* ================================
  TL;DR  -->  TLDR - Creating custom elements w/react wrappers 
TODO: Shadow dom must be set to "true" per component as shadow dom shim has been drepecated
    - Custom elements = reusable product artifact
    - React wrappers = MVP DX layer
    - Stencil components own all rendering & behavior 
================================ */

/* 
! CHOICE MADE - ADD TO READ ME: BOTH
We treat Stencil custom elements as the canonical UI layer and ship 
them framework-agnostically. For our React app, we optionally wrap 
those elements with thin React adapters to improve developer experience 
while keeping all rendering and logic inside the Web Components.
*/
import { Config } from '@stencil/core';

export const config: Config = {
  namespace: 'trust-center',
  tsconfig: 'tsconfig.json',
  buildDist: true,
  globalStyle: 'src/components/styles/global.css',

  outputTargets: [
    {
      type: 'dist',
      esmLoaderPath: '../loader',
    },
    {
      type: 'dist-custom-elements',
    },
  ],
};
