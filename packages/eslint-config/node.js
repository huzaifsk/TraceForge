import globals from "globals"

import { config as baseConfig } from "./base.js"

/**
 * ESLint configuration for Node.js services (apps/api).
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const nodeConfig = [
  ...baseConfig,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
]
