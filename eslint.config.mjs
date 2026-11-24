import js from "@eslint/js";
import augurConfig from "@simpleapps-com/augur-config/eslint";
import globals from "globals";

// No `Linter.Config[]` annotation: augur-config types its preset as its own `PresetConfig`
// (plugins as `unknown`), which ESLint's stricter type rejects. ESLint checks the config itself.
export default [
  ...augurConfig,
  // JS rules for the .mjs scripts only; TypeScript (mods) keeps augur-config's TS-aware rules
  { ...js.configs.recommended, files: ["**/*.mjs"] },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // The scripts are TypeScript, run by Node's type stripping
    files: [
      "**/*.mjs",
      "scripts/**/*.ts",
      "plugins/*/scripts/**/*.ts",
      "plugins/*/skills/*/scripts/*.ts",
      "tests/**/*.ts",
    ],
    languageOptions: { globals: globals.node },
    rules: {
      // Team limit is 10; augur-config warns at 15
      complexity: ["error", 10],
      "max-depth": ["error", 4],
      "max-nested-callbacks": ["error", 3],
    },
  },
  {
    // Platform standard (augur-doctor): flag calls to deprecated APIs. It needs type information,
    // so it covers the scripts tsconfig.json checks; a mod's `claude-code` types exist only after
    // `claude --plugin-dir` generates them.
    files: [
      "scripts/**/*.ts",
      "plugins/*/scripts/**/*.ts",
      "plugins/*/skills/*/scripts/*.ts",
      "tests/**/*.ts",
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: { "@typescript-eslint/no-deprecated": "warn" },
  },
  {
    // Claude Code's generated mod API types are not ours to lint
    ignores: ["node_modules/", ".lemmascript/", "plugins/*/.claude-plugin/types/"],
  },
];
