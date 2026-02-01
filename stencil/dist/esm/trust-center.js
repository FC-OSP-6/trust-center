import { p as promiseResolve, b as bootstrapLazy } from './index-DP_4Xvpc.js';
export { s as setNonce } from './index-DP_4Xvpc.js';
import { g as globalScripts } from './app-globals-DQuL1Twl.js';

/*
 Stencil Client Patch Browser v4.41.3 | MIT Licensed | https://stenciljs.com
 */

var patchBrowser = () => {
  const importMeta = import.meta.url;
  const opts = {};
  if (importMeta !== "") {
    opts.resourcesUrl = new URL(".", importMeta).href;
  }
  return promiseResolve(opts);
};

patchBrowser().then(async (options) => {
  await globalScripts();
  return bootstrapLazy([["aon-footer",[[1,"aon-footer",{"privacyPolicy":[1,"privacy-policy"],"termsAndConditions":[1,"terms-and-conditions"],"copyright":[1]}]]]], options);
});
