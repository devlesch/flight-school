import path from 'path';
import { execSync } from 'child_process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Resolve the main repo root so all git worktrees share the same .env.local
function getMainRepoRoot(): string {
  try {
    const gitCommonDir = execSync('git rev-parse --git-common-dir', { encoding: 'utf-8' }).trim();
    return path.resolve(gitCommonDir, '..');
  } catch {
    return '.';
  }
}

export default defineConfig(({ mode }) => {
    const mainRoot = getMainRepoRoot();
    const env = loadEnv(mode, mainRoot, '');
    return {
      envDir: mainRoot,
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {},
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
