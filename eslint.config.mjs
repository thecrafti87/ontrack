import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build-Ausgabe des Desktop-Pakets und lokale Arbeitskopien:
    "release/**",
    ".claude/**",
  ]),
  {
    // Electrons Hauptprozess läuft als CommonJS; die Server-Nutzlast wird
    // zur Laufzeit über einen berechneten Pfad geladen. Beides geht nur
    // mit require().
    files: ["electron/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
