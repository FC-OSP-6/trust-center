import { Config } from '@stencil/core';

export const config: Config = {
  namespace: 'components',
  tsconfig: 'tsconfig.json',
  buildDist: true,
  globalStyle: 'src/components/styles/global.css',

  outputTargets: [
    {
      type: 'dist',
      esmLoaderPath: '../loader'
    },
    {
      type: 'dist-custom-elements'
    }
  ]
  
  // Remove all testing configuration from here
  // Let Jest use the standalone config file instead
};