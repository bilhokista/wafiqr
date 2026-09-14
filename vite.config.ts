import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    // Stellar Wallets Kit pulls in crypto libs that expect Node globals in the browser.
    nodePolyfills({ globals: { global: true, Buffer: true, process: true } }),
  ],
});
