"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

export type Kartenpunkt = {
  id: string;
  art: "geraet" | "standort";
  name: string;
  untertitel: string;
  href: string;
  lat: number;
  lng: number;
};

/**
 * Kartenansicht „zuletzt gesehen".
 *
 * Leaflet mit OpenStreetMap, wie im Konzept vorgesehen — kostenlos und ohne
 * API-Schlüssel. Die Bibliothek wird erst im Browser geladen: Sie greift beim
 * Import auf `window` zu und würde beim serverseitigen Rendern abbrechen.
 */
export function KarteClient({ punkte }: { punkte: Kartenpunkt[] }) {
  const behaelter = useRef<HTMLDivElement>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!behaelter.current || punkte.length === 0) return;

    let karte: import("leaflet").Map | null = null;
    let abgebrochen = false;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (abgebrochen || !behaelter.current) return;

        karte = L.map(behaelter.current, { scrollWheelZoom: false });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        }).addTo(karte);

        const marker = punkte.map((p) => {
          /**
           * Eigenes Symbol statt des Leaflet-Standards: Dessen Bilddateien
           * werden über relative Pfade geladen, die durch das Bündeln
           * verlorengehen — der klassische Fall des unsichtbaren Markers.
           * Ein Inline-SVG hat dieses Problem nicht und funktioniert offline.
           */
          const farbe = p.art === "geraet" ? "#f59e0b" : "#38bdf8";
          const symbol = L.divIcon({
            className: "",
            html: `<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
              <path d="M13 33C13 33 24 20.5 24 13A11 11 0 1 0 2 13c0 7.5 11 20 11 20Z"
                    fill="${farbe}" stroke="#18181b" stroke-width="2"/>
              <circle cx="13" cy="13" r="4.5" fill="#18181b"/>
            </svg>`,
            iconSize: [26, 34],
            iconAnchor: [13, 34],
            popupAnchor: [0, -30],
          });

          return L.marker([p.lat, p.lng], { icon: symbol })
            .addTo(karte!)
            .bindPopup(
              `<strong>${escapeHtml(p.name)}</strong><br>${escapeHtml(p.untertitel)}<br>` +
                `<a href="${escapeHtml(p.href)}">Öffnen</a>`
            );
        });

        const gruppe = L.featureGroup(marker);
        karte.fitBounds(gruppe.getBounds(), { padding: [40, 40], maxZoom: 16 });
      } catch {
        setFehler(
          "Die Karte konnte nicht geladen werden. Kartenkacheln kommen von OpenStreetMap und brauchen eine Verbindung."
        );
      }
    })();

    return () => {
      abgebrochen = true;
      karte?.remove();
    };
  }, [punkte]);

  if (punkte.length === 0) return null;

  return (
    <>
      {fehler && <p className="text-sm text-amber-400">{fehler}</p>}
      <div
        ref={behaelter}
        className="w-full rounded-2xl border border-line overflow-hidden"
        style={{ height: "min(70vh, 600px)" }}
        role="application"
        aria-label="Karte der zuletzt gesehenen Geräte und Standorte"
      />
    </>
  );
}

/** Popup-Inhalt wird als HTML eingesetzt — Gerätenamen sind freie Eingaben. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
