import { defineConfig } from 'vite';

// Meta Quest Browser requires HTTPS (or localhost) to grant WebXR immersive-ar.
// `npm run dev` binds to all interfaces so it can be reached from the headset
// over the local network via a tunnel/https proxy (see README.md).
export default defineConfig({
  root: '.',
  // Relative base so the build works from a domain root (custom hosting)
  // AND from a GitHub Pages project site served under "/<repo-name>/" -
  // every asset reference in the built output becomes a relative path
  // instead of assuming "/".
  base: './',
  // The repository's existing asset tree (assets/**) is served as-is at "/",
  // e.g. assets/characters/humans/swat.glb -> /characters/humans/swat.glb
  publicDir: 'assets',
  server: {
    host: true,
    port: 5173
  },
  preview: {
    host: true,
    port: 4173
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 4000
  }
});
