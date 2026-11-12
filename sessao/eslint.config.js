import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // os projetos nativos (Capacitor) guardam cópias do build; native/, android-tools/ e
  // .gradle-user/ são pastas locais fora do git (tentativa com Expo e ferramentas do Android)
  globalIgnores(['dist', 'capacitor-android', 'ios', 'android-tools', 'native', '.gradle-user']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])
