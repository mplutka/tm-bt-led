const nodeGlobals = Object.fromEntries(
  [
    "require", "module", "exports", "process", "Buffer", "console", "__dirname", "__filename",
    "setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "clearImmediate",
    "Promise", "URL", "AbortController", "queueMicrotask", "structuredClone", "performance"
  ].map((name) => [name, "readonly"])
);

module.exports = [
  {
    ignores: ["node_modules/**", "dist/**", "patches/**", "dumps/**"]
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: nodeGlobals
    },
    rules: {
      "no-dupe-class-members": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-undef": "error",
      "no-unreachable": "error",
      "no-self-assign": "error",
      "no-cond-assign": ["error", "except-parens"],
      "no-const-assign": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
      "no-unsafe-negation": "error",
      "no-mixed-operators": [
        "error",
        { groups: [["&&", "||", "??"]], allowSamePrecedence: true }
      ]
    }
  }
];
