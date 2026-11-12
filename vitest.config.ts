/* ZAVZ - opZywl | https://lucas-lima.xyz */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    clearMocks: true,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
