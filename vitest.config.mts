import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('./shared/index.ts', import.meta.url)) },
  },
  test: {
    include: ['server/test/**/*.test.ts', 'shared/**/*.test.ts'],
    environment: 'node',
    testTimeout: 10_000,
    // Bağlantı kopma testlerinde gerçek süreleri (2 dk, 10 sn) beklememek için.
    env: {
      RECONNECT_GRACE_MS: '1500',
      DRAWER_GRACE_MS: '800',
      CHOOSE_MS: '1500',
      TURN_END_MS: '300',
      TEAM_INTRO_MS: '300',
      TEAM_RESULT_MS: '300',
    },
  },
});
