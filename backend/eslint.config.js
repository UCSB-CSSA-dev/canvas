import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["convex/_generated/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
