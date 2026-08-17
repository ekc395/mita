import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // tsconfig sets jsx: "preserve" for Next's own compiler, which esbuild cannot
  // emit, so name the runtime here instead.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@': path.dirname(fileURLToPath(import.meta.url)) },
  },
  test: { environment: 'jsdom' },
});
