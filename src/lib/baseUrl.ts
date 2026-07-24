import "server-only";
import { headers } from "next/headers";
import { prisma } from "./prisma";

/**
 * Basis-URL für QR-Codes und NFC-Tags — gleiche Logik wie beim Etikettendruck
 * (src/app/api/etiketten/route.ts): Setting "appUrl" falls in den Einstellungen
 * gesetzt, sonst aus den Request-Headern abgeleitet (funktioniert dann nur für
 * den gerade verwendeten Host, z. B. localhost in der Entwicklung).
 */
export async function resolveBaseUrl(): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: "appUrl" } });
  const configured = setting?.value?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const forwardedProto = h.get("x-forwarded-proto");
  const proto = forwardedProto ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}
