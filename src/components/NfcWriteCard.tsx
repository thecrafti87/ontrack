"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { isNfcSupported, writeNfc } from "./NfcSupport";

type WriteStatus = "idle" | "writing" | "success" | "error";

function subscribeNoop() {
  return () => {};
}
function getServerSnapshot() {
  return false;
}

/**
 * "NFC-Tag beschreiben" für Geräte-/Case-Detailseiten. Auf Geräten mit Web NFC
 * (Chrome/Edge Android) ein echter Schreib-Button; sonst ein Hinweis mit der
 * URL zum manuellen Beschreiben per Dritt-App (z. B. am iPhone) + Kopieren.
 *
 * Support-Erkennung über useSyncExternalStore (siehe NfcReadButton) — server-
 * und hydration-sicher, da SSR das Browser-Feature nicht kennen kann.
 */
export function NfcWriteCard({ url }: { url: string }) {
  const supported = useSyncExternalStore(subscribeNoop, isNfcSupported, getServerSnapshot);
  const [status, setStatus] = useState<WriteStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function handleWrite() {
    setStatus("writing");
    setMessage(null);
    const result = await writeNfc(url);
    if (result.ok) {
      setStatus("success");
      navigator.vibrate?.(80);
    } else {
      setStatus("error");
      setMessage(result.message);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Zwischenablage nicht verfügbar — Input bleibt zum manuellen Markieren.
    }
  }

  if (supported) {
    return (
      <div className="card flex flex-col gap-3">
        <h2 className="font-semibold">NFC-Tag</h2>
        <button
          type="button"
          className="btn-secondary self-start"
          disabled={status === "writing"}
          onClick={handleWrite}
        >
          {status === "writing" ? "Halte den Tag ans Handy…" : "Tag beschreiben"}
        </button>
        {status === "success" && <p className="text-sm text-emerald-400">✓ Tag beschrieben</p>}
        {status === "error" && <p className="text-sm text-red-400">{message}</p>}
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-2">
      <h2 className="font-semibold text-sm">NFC-Tag beschreiben</h2>
      <p className="text-sm text-muted">
        Am iPhone per Dritt-App (z. B. „NFC Tools“) mit dieser URL:
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="NFC-URL"
          className="input font-mono text-sm flex-1"
        />
        <button type="button" className="btn-secondary shrink-0" onClick={handleCopy}>
          {copied ? "Kopiert ✓" : "Kopieren"}
        </button>
      </div>
    </div>
  );
}
