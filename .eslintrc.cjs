/** Root ESLint config. Per-package configs extend this one. */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "prettier",
  ],
  settings: {
    "import/resolver": {
      typescript: { alwaysTryTypes: true },
      node: { extensions: [".js", ".jsx", ".ts", ".tsx"] },
    },
  },
  ignorePatterns: [
    "node_modules",
    "dist",
    "build",
    "coverage",
    "dist-electron",
    "**/*.config.js",
    "**/*.config.cjs",
    "**/*.config.ts",
    "backend/prisma/migrations",
    "mobile_cashier",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/consistent-type-imports": [
      "warn",
      { prefer: "type-imports", disallowTypeAnnotations: false },
    ],
    "import/order": [
      "warn",
      {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index", "object", "type"],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true },
      },
    ],
    "import/no-duplicates": "error",
    // false positives on CJS packages re-exported through esModuleInterop
    "import/default": "off",
    "import/no-named-as-default": "off",
    "import/no-named-as-default-member": "off",
    "import/namespace": "off",
    "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    eqeqeq: ["error", "smart"],
    "no-var": "error",
    "prefer-const": "warn",
  },
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
      env: { jest: true },
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
    {
      // CommonJS config files legitimately use require().
      files: ["**/*.cjs", "**/.eslintrc.cjs", "**/commitlint.config.cjs"],
      rules: {
        "@typescript-eslint/no-require-imports": "off",
        "@typescript-eslint/no-var-requires": "off",
      },
    },
  ],
};
