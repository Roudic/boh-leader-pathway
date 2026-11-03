import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site at https://roudic.github.io/<repo-name>/
// If you rename the repo, change REPO_NAME (the workflow also passes it in automatically).
const REPO_NAME = process.env.REPO_NAME || 'boh-leader-pathway';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? `/${REPO_NAME}/` : '/',
}));
