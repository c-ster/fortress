import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@fortress/types': path.resolve(__dirname, '../packages/types/src'),
    },
  },
  test: {
    globals: true,
  },
});
