"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isNfcSupported, readNfc, type NfcReadHandle } from "./NfcSupport";

function subscribeNoop() {
  return () => {};
}
function getServerSnapshot() {
  return false;
}

/**
 * "NFC lesen"-Toggle für die Scan-Seiten. Rendert NICHTS, wenn Web NFC auf
 * diesem Gerät nicht verfügbar ist (u. a. iPhone/Safari — dort gibt es kein
 * Web NFC). Gelesene Codes laufen über onCode genau wie QR-Codes.
 *
 * Die Support-Erkennung liest ein Browser-Feature, das dem SSR-Server nicht
 * bekannt ist — useSyncExternalStore liefert dafür server- und
 * hydration-sicher immer `false` beim SSR-Pass (getServerSnapshot) und erst
 * beim ersten Client-Render den echten Wert, ohne Hydration-Mismatch.
 */
export function NfcReadButton({ onCode }: { onCode: (text: string) => void }) {
  const supported = useSyncExternalStore(subscribeNoop, isNfcSupported, getServerSnapshot);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<NfcReadHandle | null>(null);
  const onCodeRef = useRef(onCode);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    return () => {
      handleRef.current?.stop();
      handleRef.current = null;
    };
  }, []);

  if (!supported) return null;

  function start() {
    setError(null);
    let failedImmediately = false;
    handleRef.current = readNfc(
      (text) => onCodeRef.current(text),
      (message) => {
        setError(message);
        setActive(false);
        failedImmediately = true;
      }
    );
    // Bei sofortigem (synchronem) Fehlschlag nicht als "aktiv" anzeigen —
    // spätere (asynchrone) Fehler setzen active oben bereits selbst zurück.
    if (!failedImmediately) setActive(true);
  }

  function stop() {
    handleRef.current?.stop();
    handleRef.current = null;
    setActive(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className={active ? "btn-primary" : "btn-secondary"}
        onClick={() => (active ? stop() : start())}
      >
        {active ? "📡 NFC aktiv — antippen zum Stoppen" : "📡 NFC lesen"}
      </button>
      {active && <p className="text-sm text-accent">NFC aktiv — halte einen Tag ans Gerät</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
