import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: [
      'src/components/report/ReportNews.tsx',
      'src/components/report/StockDailyKlineCard.tsx',
      'src/components/settings/AuthSettingsCard.tsx',
      'src/contexts/AuthContext.tsx',
      'src/pages/ChatPage.tsx',
      'src/pages/ConceptBoardsPage.tsx',
      'src/pages/MarketScanRatingHistoryPanel.tsx',
      'src/pages/MarketScannerPage.tsx',
      'src/pages/PortfolioPage.tsx',
      'src/pages/PortfolioSelectionPage.tsx',
      'src/pages/SignalDigestPage.tsx',
      'src/pages/WatchlistPage.tsx',
    ],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
