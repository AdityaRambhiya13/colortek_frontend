import { defineConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default defineConfig({
  ...viteConfig,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
})
