import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Bestimmung des Basispfads für GitHub Pages.
 *
 * Priorität:
 * 1. VITE_BASE   – explizite Vorgabe (z. B. "/" für eine eigene Domain oder
 *                  "/custom-pfad/" für ein ungewöhnliches Deploy-Ziel).
 * 2. CI-Kontext  – in GitHub Actions steht GITHUB_REPOSITORY ("owner/repo").
 *                  Projektseiten laufen unter https://owner.github.io/repo/,
 *                  Benutzer-/Organisationsseiten (repo = owner.github.io)
 *                  laufen direkt unter https://owner.github.io/.
 * 3. Lokal       – relative Basis "./", damit `npm run preview` unabhängig vom
 *                  Auslieferungspfad funktioniert.
 *
 * Alle Asset-Pfade laufen über die Vite-Basis bzw. import.meta.env.BASE_URL.
 * Es werden keine hartcodierten absoluten Pfade verwendet.
 */
export function resolveBase(): string {
  const explicit = process.env.VITE_BASE;
  if (explicit && explicit.trim() !== '') {
    const trimmed = explicit.trim();
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  }

  const repository = process.env.GITHUB_REPOSITORY;
  if (repository) {
    const [owner, repo] = repository.split('/');
    if (owner && repo) {
      // Benutzer- oder Organisationsseite: owner.github.io → Basis "/"
      if (repo.toLowerCase() === `${owner.toLowerCase()}.github.io`) return '/';
      return `/${repo}/`;
    }
  }

  return './';
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? resolveBase() : './',
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  preview: {
    port: 4173,
  },
  test: {
    // jsdom für alle Tests: Physik-Tests laufen ohne DOM-Abhängigkeiten,
    // UI-Smoke-Tests benötigen ein Document.
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: false,
  },
}));
