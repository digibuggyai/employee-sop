import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { files: ["src/components/Avatar.tsx"], rules: { "@next/next/no-img-element": "off" } },
  { files: ["src/lib/viewAs.ts"], rules: { "@next/next/no-location-assign-relative-destination": "off" } },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
