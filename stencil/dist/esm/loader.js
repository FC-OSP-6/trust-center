import { b as bootstrapLazy } from './index-DP_4Xvpc.js';
export { s as setNonce } from './index-DP_4Xvpc.js';
import { g as globalScripts } from './app-globals-DQuL1Twl.js';

const defineCustomElements = async (win, options) => {
  if (typeof window === 'undefined') return undefined;
  await globalScripts();
  return bootstrapLazy([["aon-footer",[[1,"aon-footer",{"privacyPolicy":[1,"privacy-policy"],"termsAndConditions":[1,"terms-and-conditions"],"copyright":[1]}]]]], options);
};

export { defineCustomElements };
