'use strict';

var index = require('./index-BznpBypI.js');
var appGlobals = require('./app-globals-V2Kpy_OQ.js');

const defineCustomElements = async (win, options) => {
  if (typeof window === 'undefined') return undefined;
  await appGlobals.globalScripts();
  return index.bootstrapLazy([["aon-footer.cjs",[[1,"aon-footer",{"privacyPolicy":[1,"privacy-policy"],"termsAndConditions":[1,"terms-and-conditions"],"copyright":[1]}]]]], options);
};

exports.setNonce = index.setNonce;
exports.defineCustomElements = defineCustomElements;
