import js from "@eslint/js";
import prettier from "eslint-plugin-prettier/recommended";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "dist-sdk", "public/assets"] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: { "@typescript-eslint/no-explicit-any": ["error", { "ignoreRestArgs": false, "fixToUnknown": false, "allowCommentedAny": true }], },
  },
);
