import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
  { ignores: ['dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'blob-report/**'] },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // Проект на React 18 с новым JSX-трансформом: импорт React в
      // области видимости не нужен, и требовать его — ложные срабатывания.
      'react/react-in-jsx-scope': 'off',

      // PropTypes в проекте не используются; включать правило значит
      // получить замечание на каждый компонент разом.
      'react/prop-types': 'off',
    },
  },

  {
    // Тесты и конфиги исполняются в Node, а не в браузере.
    files: ['tests/**/*.js', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
]
