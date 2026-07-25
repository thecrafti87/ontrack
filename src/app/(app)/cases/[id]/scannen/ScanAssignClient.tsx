"use client";

import { useEffect, useState } from "react";
import QrScanner from "@/components/QrScanner";
import { NfcReadButton } from "@/components/NfcReadButton";
import {
  scanCheckAction,
  assignBatchAction,
  type ScanCheckResult,
  type AssignBatchResult,
  type AssignBatchOutcome,
} from "../../actions";

type CollectedKind = "ready" | "alreadyHere" | "otherCase" | "unknown";

type CollectedEntry = {
  id: number;
  inventoryNo: string;
  deviceName?: string;
  kind: CollectedKind;
  otherCaseName?: string;
  allowMove: boolean;
};

const KIND_BADGE: Record<CollectedKind, string> = {
  ready: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  alreadyHere: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  otherCase: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  unknown: "bg-red-500/15 text-red-400 border-red-500/30",
};

const KIND_LABEL: Record<CollectedKind, string> = {
  ready: "Bereit",
  alreadyHere: "Schon im Case",
  otherCase: "In anderem Case",
  unknown: "Unbekannt",
};

const OUTCOME_BADGE: Record<AssignBatchOutcome, string> = {
  assigned: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  moved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  skippedUnknown: "bg-red-500/15 text-red-400 border-red-500/30",
  skippedAlready: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  skippedOtherCase: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const OUTCOME_LABEL: Record<AssignBatchOutcome, string> = {
  assigned: "Zugeordnet",
  moved: "Umgehängt",
  skippedUnknown: "Unbekannt",
  skippedAlready: "Schon im Case",
  skippedOtherCase: "Übersprungen",
};

let nextEntryId = 1;
let nextHintId = 1;

function describeResult(r: AssignBatchResult): string {
  const label = r.deviceName ? `${r.deviceName} (${r.inventoryNo})` : r.inventoryNo || "?";
  switch (r.outcome) {
    case "assigned":
      return `${label} → zugeordnet`;
    case "moved":
      return `${label} → umgehängt`;
    case "skippedAlready":
      return `${label} — war schon im Case`;
    case "skippedOtherCase":
      return `${label} — hängt in ${r.detail ?? "anderem Case"}, nicht umgehängt`;
    case "skippedUnknown":
      return `${label} — unbekannt`;
    default:
      return label;
  }
}

export function ScanAssignClient({ caseId }: { caseId: string }) {
  const [entries, setEntries] = useState<CollectedEntry[]>([]);
  const [manualValue, setManualValue] = useState("");
  const [pending, setPending] = useState(false);
  const [hint, setHint] = useState<{ id: number; text: string } | null>(null);
  const [results, setResults] = useState<AssignBatchResult[] | null>(null);
  const [assignedTotal, setAssignedTotal] = useState(0);

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => {
      setHint((h) => (h?.id === hint.id ? null : h));
    }, 3000);
    return () => clearTimeout(t);
  }, [hint]);

  function showHint(text: string) {
    setHint({ id: nextHintId++, text });
  }

  async function handleCode(code: string) {
    setPending(true);
    const res: ScanCheckResult = await scanCheckAction(caseId, code);
    setPending(false);

    if (res.kind === "isCase") {
      showHint(res.message ?? "Das ist ein Case-Code — bitte Geräte scannen");
      return;
    }
    if (res.kind === "error") {
      showHint(res.message ?? "Fehler");
      return;
    }

    const inventoryNo = res.inventoryNo ?? code.trim();
    if (entries.some((e) => e.inventoryNo === inventoryNo)) {
      showHint(`${inventoryNo} ist schon in der Liste`);
      return;
    }

    // res.kind ist an dieser Stelle auf CollectedKind eingeschränkt (isCase/error
    // wurden oben bereits behandelt und haben die Funktion verlassen).
    const kind = res.kind as CollectedKind;

    setEntries((prev) => [
      {
        id: nextEntryId++,
        inventoryNo,
        deviceName: res.deviceName,
        kind,
        otherCaseName: res.otherCaseName,
        allowMove: false,
      },
      ...prev,
    ]);
  }

  function handleManualSubmit() {
    const value = manualValue.trim();
    if (!value) return;
    setManualValue("");
    void handleCode(value);
  }

  function toggleAllowMove(id: number) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, allowMove: !e.allowMove } : e)));
  }

  function removeEntry(id: number) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function clearList() {
    if (entries.length === 0) return;
    if (!confirm("Sammelliste wirklich leeren?")) return;
    setEntries([]);
  }

  async function handleConfirm() {
    if (entries.length === 0) return;
    setPending(true);
    const items = entries.map((e) => ({ inventoryNo: e.inventoryNo, allowMove: e.allowMove }));
    const res = await assignBatchAction(caseId, items);
    setPending(false);

    const successCount = res.filter((r) => r.outcome === "assigned" || r.outcome === "moved").length;
    if (successCount > 0) {
      navigator.vibrate?.(80);
      setAssignedTotal((c) => c + successCount);
    }

    setResults(res);
    setEntries([]);
  }

  function handleContinueScanning() {
    setResults(null);
  }

  const executableCount = entries.filter(
    (e) => e.kind === "ready" || (e.kind === "otherCase" && e.allowMove)
  ).length;

  if (results) {
    const successCount = results.filter((r) => r.outcome === "assigned" || r.outcome === "moved").length;
    const skippedCount = results.length - successCount;

    return (
      <div className="flex flex-col gap-4">
        <div className="card flex items-center justify-between gap-3">
          <span className="text-sm text-muted">Ergebnis</span>
          <span className="text-lg font-semibold">
            <span className="text-emerald-400">{successCount} zugeordnet</span>
            {", "}
            <span className="text-muted">{skippedCount} übersprungen</span>
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {results.map((r, i) => (
            <div key={i} className="card flex items-center gap-3 py-3">
              <span className={`badge shrink-0 ${OUTCOME_BADGE[r.outcome]}`}>{OUTCOME_LABEL[r.outcome]}</span>
              <span className="text-sm truncate">{describeResult(r)}</span>
            </div>
          ))}
        </div>

        <button type="button" className="btn-primary" onClick={handleContinueScanning}>
          Weiter scannen
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="card flex items-center gap-4">
        <div className="flex-1 flex items-center justify-between">
          <span className="text-sm text-muted">Gesammelt</span>
          <span className="text-2xl font-bold text-accent">{entries.length}</span>
        </div>
        {assignedTotal > 0 && (
          <div className="flex-1 flex items-center justify-between border-l border-line pl-4">
            <span className="text-sm text-muted">Zugeordnet</span>
            <span className="text-2xl font-bold text-emerald-400">{assignedTotal}</span>
          </div>
        )}
      </div>

      {hint && (
        <div className="card bg-amber-500/10 border-amber-500/30 py-2">
          <p className="text-sm text-amber-300">{hint.text}</p>
        </div>
      )}

      <QrScanner onCode={(text) => void handleCode(text)} />

      <NfcReadButton onCode={(text) => void handleCode(text)} />

      <div className="card flex flex-col gap-3">
        <label className="label" htmlFor="scan-manual">
          Inventar- oder Seriennummer
        </label>
        <div className="flex gap-3">
          <input
            id="scan-manual"
            className="input flex-1"
            placeholder="z. B. OT-0001 oder Seriennummer"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleManualSubmit();
              }
            }}
          />
          <button
            type="button"
            className="btn-primary shrink-0"
            disabled={pending}
            onClick={handleManualSubmit}
          >
            {pending ? "…" : "Prüfen"}
          </button>
        </div>
      </div>

      {entries.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">{entries.length} in der Liste</span>
          <button type="button" className="btn-secondary" onClick={clearList}>
            Liste leeren
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {entries.map((entry) => (
          <div key={entry.id} className="card flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className={`badge shrink-0 ${KIND_BADGE[entry.kind]}`}>
                {entry.kind === "otherCase" ? `In ${entry.otherCaseName}` : KIND_LABEL[entry.kind]}
              </span>
              <span className="text-sm truncate">
                {entry.deviceName ? `${entry.deviceName} (${entry.inventoryNo})` : entry.inventoryNo}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {entry.kind === "otherCase" && (
                <label className="flex items-center gap-1.5 text-xs text-muted select-none">
                  <input
                    type="checkbox"
                    checked={entry.allowMove}
                    onChange={() => toggleAllowMove(entry.id)}
                    className="size-4"
                  />
                  Umhängen erlauben
                </label>
              )}
              <button
                type="button"
                className="text-muted hover:text-red-400 text-lg leading-none px-1"
                onClick={() => removeEntry(entry.id)}
                aria-label="Entfernen"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted text-center">
        Noch nichts zugewiesen — erst „jetzt zuordnen“ führt die Zuweisung aus.
      </p>

      <div className="sticky bottom-24 md:bottom-4 -mx-4 md:mx-0 px-4 md:px-0 pt-2">
        <button
          type="button"
          className="btn-primary w-full shadow-lg shadow-black/40"
          disabled={pending || executableCount === 0}
          onClick={handleConfirm}
        >
          {pending ? "…" : `${executableCount} Geräte jetzt zuordnen`}
        </button>
      </div>
    </div>
  );
}
