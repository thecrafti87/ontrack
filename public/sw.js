/**
 * Service Worker für OnTrack.
 *
 * Zweck: Die App soll sich auch dann öffnen lassen, wenn kein Netz da ist —
 * etwa wenn das Handy im Hallenkeller den Bildschirm sperrt und die Seite
 * neu lädt.
 *
 * Bewusst sehr zurückhaltend gehalten. Ein Service Worker, der zu viel
 * zwischenspeichert, liefert veraltete Bestände aus, und das wäre schlimmer
 * als gar keiner: Man würde einem Gerätestatus vertrauen, den es so nicht
 * mehr gibt. Deshalb gilt:
 *
 *   - Seiten und Daten kommen IMMER zuerst aus dem Netz.
 *   - Zwischengespeichert werden nur unveränderliche Dateien
 *     (/_next/static/… trägt einen Inhalts-Hash im Namen) und die Symbole.
 *   - Schreibende Anfragen und Server-Aktionen werden nie angefasst.
 */

const VERSION = "ontrack-v1";
const STATIC_CACHE = `${VERSION}-static`;
const SHELL_CACHE = `${VERSION}-shell`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icon-192.png", "/icon-512.png"]))
      // Schlägt das Vorladen fehl, soll die Installation trotzdem gelingen —
      // ohne Service Worker ist die App brauchbar, mit halbem nicht.
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((namen) =>
        Promise.all(
          namen.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Nur einfache Leseanfragen. Server-Aktionen sind POSTs und dürfen unter
  // keinen Umständen aus einem Zwischenspeicher beantwortet werden.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Unveränderliche Dateien: Inhalts-Hash im Namen, also gefahrlos.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (treffer) =>
          treffer ??
          fetch(request).then((antwort) => {
            const kopie = antwort.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, kopie));
            return antwort;
          })
      )
    );
    return;
  }

  // Seitenaufrufe: immer zuerst das Netz. Nur wenn es nicht antwortet, die
  // Offline-Seite — niemals eine zwischengespeicherte Bestandsseite.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((treffer) => treffer ?? Response.error())
      )
    );
    return;
  }

  // Alles Übrige unangetastet lassen.
});
