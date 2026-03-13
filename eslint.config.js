import prettier from "eslint-config-prettier";

export default [
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        document: "readonly",
        window: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Blob: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        L: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "eqeqeq": ["warn", "smart"],
      "no-var": "error",
      "prefer-const": "warn",
    },
  },
  prettier,
];
