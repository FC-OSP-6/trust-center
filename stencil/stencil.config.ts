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
import { reactOutputTarget } from '@stencil/react-output-target';

export const config: Config = {
  namespace: 'trust-center',

  outputTargets: [
    /* 
         Custom Elements Output
          - Framework-agnostic web components.
          - This is the artifact the client can reuse directly.
        */
    {
      type: 'dist',
      esmLoaderPath: '../loader',
    },

    /* 
        React Wrapper Output
        - thin adapters for MVP dev experience - basically a
        - No logic/state/styling 
        */
    reactOutputTarget({
      // Relative path to where the React components will be generated
      outDir: '../client/src/stencil',
    }),

    //Loader Ouput type ensure custom elements are registered once + used by react/any future consumers.
    {
      type: 'dist-custom-elements',
      externalRuntime: false,
    },
  ],
};
