module.exports = {
  extends: ["../.eslintrc.cjs"],
  env: { node: true, es2022: true },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
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
