import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import securityPlugin from "eslint-plugin-security";

export default [
  {
    files: ["**/*.ts"],
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  securityPlugin.configs.recommended,
  {
    rules: {
      "security/detect-object-injection": "off",
    },
  },
];
