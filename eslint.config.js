import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "vendor/**", "node_modules/**", "skills/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { window: "readonly", document: "readonly", console: "readonly", process: "readonly", location: "readonly", setTimeout: "readonly", clearTimeout: "readonly", performance: "readonly", requestAnimationFrame: "readonly", navigator: "readonly", URLSearchParams: "readonly", localStorage: "readonly", fetch: "readonly" } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-properties": ["error", { object: "Math", property: "random", message: "Seeded RNG only in sim; cosmetic randomness must go through render/cosmetic.ts" }]
    }
  },
  { files: ["src/render/cosmetic.ts", "tools/**"], rules: { "no-restricted-properties": "off" } }
);
