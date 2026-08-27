import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // tsconfig sets jsx: "preserve" for Next's own compiler, which the test
  // transformer cannot emit, so name the runtime here instead. Vite 8 (vitest 4)
  // swapped esbuild for oxc and silently ignores an `esbuild` block, surfacing
  // as an unparseable JSX expression rather than a config error.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: { '@': path.dirname(fileURLToPath(import.meta.url)) },
  },
  test: { environment: 'jsdom' },
});
