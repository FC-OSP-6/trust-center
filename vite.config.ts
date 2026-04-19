/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  tl;dr  -->  vite dev / build config

  - enables react support
  - proxies /api/health and /graphql to express server
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

import { defineConfig, loadEnv } from 'vite'; // config helper + mode-aware env loader (.env, .env.[mode], etc.)
import react from '@vitejs/plugin-react'; // enables react fast refresh + jsx/tsx transform
import net from 'node:net';

async function findAvailableVitePort(startPort: number, endPort: number) {
  for (let port = startPort; port <= endPort; port += 1) {
    const isAvailable = await new Promise<boolean>(resolve => {
      const probe = net.createServer();

      probe.once('error', () => resolve(false));
      probe.listen(port, '127.0.0.1', () => {
        probe.close(() => resolve(true));
      });
    });

    if (isAvailable) return port;
  }

  throw new Error(
    `No available Vite dev port found in range ${startPort}-${endPort}`
  );
}

export default defineConfig(async ({ mode, command }) => {
  // loads both VITE_* and non-vite vars  -->  returns an object  ;  does NOT automatically populate process.env
  const env = loadEnv(mode, process.cwd(), '');

  // prefer shell env for combined dev launchers, then fall back to .env values
  const host = process.env.HOST ?? env.HOST ?? 'http://localhost';
  const serverPort = Number(process.env.SERVER_PORT ?? env.SERVER_PORT ?? 4000);
  const serverTarget = `${host}:${serverPort}`; // ex:  http://localhost:4000
  const viteHost = process.env.VITE_DEV_HOST ?? env.VITE_DEV_HOST ?? undefined;
  const explicitVitePort = process.env.VITE_DEV_PORT ?? env.VITE_DEV_PORT;
  const vitePort =
    command !== 'serve'
      ? Number(explicitVitePort ?? 5173)
      : explicitVitePort
        ? Number(explicitVitePort)
        : await findAvailableVitePort(5173, 5199);

  return {
    base: '/trust-center/',
    plugins: [react()], // required for tsx + fast refresh

    // fixes vite bundling issue  -->  only load react once (react hook error)
    resolve: {
      dedupe: ['react', 'react-dom']
    },

    optimizeDeps: { include: ['react', 'react-dom'] },

    server: {
      host: viteHost,
      port: vitePort,
      strictPort: true,
      proxy: {
        // preserves method + json + headers  -->  no hardcoding,  no path rewriting,  no websocket upgrades needed for MVP
        '/api/health': { target: serverTarget, changeOrigin: true },
        '/graphql': { target: serverTarget, changeOrigin: true }
      }
    },

    build: {
      // output is relative to the vite root  -->  rrepo root by default, rerouted in package.json
      outDir: 'dist',
      emptyOutDir: true
    }
  };
});
