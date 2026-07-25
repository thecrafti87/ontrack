"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QrScanner from "@/components/QrScanner";
import { NfcReadButton } from "@/components/NfcReadButton";

/** Aus einem gescannten Text die Inventarnummer extrahieren. */
function extractInventoryNo(text: string): string {
  try {
    const url = new URL(text);
    if (url.pathname.startsWith("/d/")) {
      return decodeURIComponent(url.pathname.slice("/d/".length));
    }
  } catch {
    // kein gültiges URL-Format — Rohtext wird als Inventarnummer verwendet
  }
  return text.trim();
}

export default function ScanPage() {
  const router = useRouter();
  const navigatedRef = useRef(false);
  const [manualValue, setManualValue] = useState("");

  function handleCode(text: string) {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    const inventoryNo = extractInventoryNo(text);
    router.push(`/d/${encodeURIComponent(inventoryNo)}`);
  }

  function openManual() {
    const value = manualValue.trim();
    if (!value) return;
    router.push(`/d/${encodeURIComponent(value)}`);
  }

  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto flex flex-col gap-4">
      <h1 className="text-2xl font-bold">QR-/Barcode-Scan</h1>

      <QrScanner onCode={handleCode} />

      <NfcReadButton onCode={handleCode} />

      <div className="card flex flex-col gap-3">
        <label className="label" htmlFor="manual-inventory">
          Inventar- oder Seriennummer
        </label>
        <div className="flex gap-3">
          <input
            id="manual-inventory"
            className="input flex-1"
            placeholder="z. B. OT-0001 oder Seriennummer"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                openManual();
              }
            }}
          />
          <button type="button" className="btn-primary shrink-0" onClick={openManual}>
            Öffnen
          </button>
        </div>
      </div>
    </div>
  );
}
