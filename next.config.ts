import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Der Desktop-Build (Electron) startet den mitgelieferten Server direkt aus
  // .next/standalone — ohne node_modules daneben. Docker profitiert ebenfalls.
  output: "standalone",

  // Die native Prisma-Query-Engine (libquery_engine-*.node) wird vom
  // Datei-Tracing nicht zuverlässig erkannt und fehlt sonst im Standalone-Output.
  outputFileTracingIncludes: {
    "/*": ["node_modules/.prisma/client/**/*"],
  },

  // Umgekehrt zieht das Tracing über den Datenbankpfad die lokale
  // Entwicklungsdatenbank und hochgeladene Dateien mit hinein. Die haben in
  // keinem Build etwas zu suchen.
  outputFileTracingExcludes: {
    "/*": ["data/**/*", "prisma/data/**/*"],
  },
};

export default nextConfig;
