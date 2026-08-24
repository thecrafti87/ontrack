"use client";

import { useEffect } from "react";

/**
 * Meldet den Service Worker an — nur im Produktionsbetrieb.
 *
 * In der Entwicklung wäre er ein Ärgernis: Er würde alte Dateien ausliefern
 * und jede Änderung mit einem rätselhaften Zwischenspeicher überdecken.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // Erst nach dem Laden anmelden, damit die Anmeldung nicht mit dem
    // erstmaligen Aufbau der Seite um Bandbreite konkurriert.
    const anmelden = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ohne Service Worker funktioniert die App vollständig, nur eben
        // nicht offline. Kein Grund, den Benutzer damit zu behelligen.
      });
    };

    if (document.readyState === "complete") anmelden();
    else window.addEventListener("load", anmelden, { once: true });

    return () => window.removeEventListener("load", anmelden);
  }, []);

  return null;
}
