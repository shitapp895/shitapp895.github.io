import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import a11yPlugin from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    // Global ignores
    ignores: [
      'node_modules/**',
      'dist/**',
      '.husky/**',
      '**/*.min.js',
      '**/*.bundle.js',
      '**/package-lock.json',
      'build/**',
    ],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // JavaScript/config files
    files: ['*.js', '*.jsx', '*.cjs', '*.mjs', '*.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        document: true,
        navigator: true,
        window: true,
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': a11yPlugin,
      import: importPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      'prettier/prettier': 'warn',
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error', 'info'],
        },
      ],
      eqeqeq: 'warn',
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },
  {
    // TypeScript files
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['dist/**', 'node_modules/**'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': a11yPlugin,
      import: importPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      'import/order': [
        'warn',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling'],
            'index',
            'object',
            'type',
          ],
          pathGroups: [
            {
              pattern: '@/**',
              group: 'internal',
              position: 'after',
            },
          ],
          'newlines-between': 'never',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'prettier/prettier': 'warn',
      'no-console': [
        'off',
        {
          allow: ['warn', 'error', 'info'],
        },
      ],
      eqeqeq: 'warn',
      'no-var': 'error',
      'prefer-const': 'warn',
      'import/no-unresolved': 'off',
      'import/namespace': 'off',
      'import/default': 'off',
      'import/no-named-as-default': 'off',
      'import/no-named-as-default-member': 'off',
      'import/no-duplicates': 'off',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // Overrides for specific file patterns
  {
    files: ['src/tests/**/*', '**/*.test.*', '**/*.spec.*'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['src/firebase/config.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  prettierConfig,
];
