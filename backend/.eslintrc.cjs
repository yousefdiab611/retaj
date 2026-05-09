const path = require("path");

module.exports = {
  extends: ["../.eslintrc.cjs"],
  env: { node: true, es2022: true },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  settings: {
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: path.resolve(__dirname, "tsconfig.json"),
      },
      node: { extensions: [".js", ".ts"] },
    },
  },
  rules: {
    "no-console": ["warn", { allow: ["warn", "error", "info"] }],
  },
  overrides: [
    {
      files: ["prisma/**/*.ts"],
      rules: {
        "no-console": "off",
      },
    },
  ],
};
