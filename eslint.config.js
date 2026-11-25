import js from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Lint-Konfiguration (flache Config, ESLint 10).
 *
 * Typprüfende Regeln laufen nur für TypeScript-Quelldateien; die
 * Konfigurationsdatei selbst wird ohne Projektdienst geprüft.
 *
 * Bewusst nicht aktiv: naming-convention. Einheiten-Suffixe wie
 * `volume_pL` oder `turgor_MPa` sind im Modell gewollt und verhindern
 * Einheitenfehler, auch wenn sie nicht streng camelCase sind.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.vite/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...js.browser },
    },
  },
);
