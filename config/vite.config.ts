/* ================================
  tl;dr  -->  vite dev / build config

  - enables react support
  - proxies /api/health and /graphql to express server
================================ */


import { defineConfig, loadEnv } from "vite";  // config helper + mode-aware env loader (.env, .env.[mode], etc.)
import react from "@vitejs/plugin-react";  // enables react fast refresh + jsx/tsx transform


export default defineConfig(({ mode }) => {
  // loads both VITE_* and non-vite vars  -->  returns an object  ;  does NOT automatically populate process.env
  const env = loadEnv(mode, process.cwd(), "");

  // single source of truth  -->  proxy target comes from HOST + SERVER_PORT in .env
  const host = env.HOST ?? "http://localhost";
  const port = Number(env.SERVER_PORT ?? 4000);
  const serverTarget = `${host}:${port}`;  // ex:  http://localhost:4000

  return {
    base: "/trust-center/",
    plugins: [react()],  // required for tsx + fast refresh

    // fixes vite bundling issue  -->  only load react once (react hook error)
    resolve: { dedupe: ["react", "react-dom"] },
    optimizeDeps: { include: ["react", "react-dom"] },

    server: {
      proxy: {
        // preserves method + json + headers  -->  no hardcoding,  no path rewriting,  no websocket upgrades needed for MVP
        "/api/health": { target: serverTarget, changeOrigin: true },
        "/graphql": { target: serverTarget, changeOrigin: true },
      },
    },

    build: {
      // output is relative to the vite root  -->  rrepo root by default, rerouted in package.json
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
