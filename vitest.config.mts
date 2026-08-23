import path from "node:path";
import { defineConfig } from "vitest/config";

const wurzel = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(wurzel, "src"),
      // "server-only" wirft beim Import außerhalb einer Next-Server-Umgebung.
      // Für Tests wird es durch ein leeres Modul ersetzt — die Schutzwirkung
      // gilt dem Client-Bundle, nicht dem Testlauf.
      "server-only": path.resolve(wurzel, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Die Integrationstests teilen sich eine SQLite-Datei; parallele Läufe
    // würden sich gegenseitig die Daten unter den Füßen wegziehen.
    fileParallelism: false,
  },
});
