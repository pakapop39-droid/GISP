import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".agents/**",
    ".codex-tmp/**",
    ".next/**",
    ".next-stale-*/**",
    "coverage/**",
    "node_modules/**",
    "output/**",
    "outputs/**",
    "production-release-a/**",
    "tmp/**",
  ]),
  {
    files: ["src/components/catalog-import-workspace.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "@next/next/no-html-link-for-pages": "off",
    },
  },
]);
