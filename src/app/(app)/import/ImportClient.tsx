"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { importDevicesAction, logImportSummaryAction, type ImportRow } from "./actions";

type FieldKey =
  | ""
  | "name"
  | "inventoryNo"
  | "category"
  | "serialNo"
  | "purchaseDate"
  | "purchasePrice"
  | "supplier"
  | "weightKg"
  | "notes";

const FIELD_OPTIONS: { value: FieldKey; label: string }[] = [
  { value: "", label: "— ignorieren —" },
  { value: "name", label: "Name" },
  { value: "inventoryNo", label: "Inventarnummer" },
  { value: "category", label: "Kategorie" },
  { value: "serialNo", label: "Seriennummer" },
  { value: "purchaseDate", label: "Kaufdatum" },
  { value: "purchasePrice", label: "Kaufpreis" },
  { value: "supplier", label: "Lieferant" },
  { value: "weightKg", label: "Gewicht (kg)" },
  { value: "notes", label: "Notizen" },
];

const SPOTLIGHT_MAP: Record<string, FieldKey> = {
  "instrument type": "name",
  "unit number": "inventoryNo",
  "serial number": "serialNo",
  weight: "weightKg",
  position: "notes",
  purpose: "notes",
};

type Phase = "upload" | "mapping" | "importing" | "done";

type ImportSummary = { created: number; skipped: number; skippedReasons: string[] };

/** Encoding erkennen: UTF-8 zuerst, bei Ersatzzeichen auf Windows-1252 ausweichen. */
async function decodeFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (text.includes("�")) {
    text = new TextDecoder("windows-1252").decode(buffer);
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

/** CSV/TSV-Parser mit korrekter Behandlung von Quoted Fields ("...", "" als Escape). */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += c;
        i += 1;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i += 1;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
      i += 1;
    } else if (c === "\r") {
      i += 1;
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
    } else {
      field += c;
      i += 1;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

/** Trennzeichen automatisch erkennen: höchste konsistente Spaltenzahl über die ersten Zeilen. */
function detectDelimiter(text: string): string {
  const candidates = ["\t", ";", ","];
  const sample = text.split("\n").slice(0, 15).join("\n");

  let best = { delim: ",", score: -1, cols: 0 };
  for (const delim of candidates) {
    const rows = parseDelimited(sample, delim).slice(0, 10);
    if (rows.length === 0) continue;
    const first = rows[0].length;
    if (first <= 1) continue;
    const consistent = rows.filter((r) => r.length === first).length;
    if (consistent > best.score || (consistent === best.score && first > best.cols)) {
      best = { delim, score: consistent, cols: first };
    }
  }
  return best.delim;
}

/** Header-Heuristik (case-insensitive, de+en) zur automatischen Vorbelegung. */
function guessField(header: string): FieldKey {
  const h = header.trim().toLowerCase();
  if (/name|bezeichnung|instrument type|gerät|geraet/.test(h)) return "name";
  if (/inventar|inventory|unit number/.test(h)) return "inventoryNo";
  if (/serien|serial/.test(h)) return "serialNo";
  if (/kategorie|category|type/.test(h)) return "category";
  if (/preis|price|cost/.test(h)) return "purchasePrice";
  if (/datum|date/.test(h)) return "purchaseDate";
  if (/lieferant|supplier|vendor/.test(h)) return "supplier";
  if (/gewicht|weight/.test(h)) return "weightKg";
  if (/position/.test(h)) return "notes";
  return "";
}

function applySpotlightTemplate(headers: string[], current: FieldKey[]): FieldKey[] {
  return headers.map((header, idx) => {
    const key = header.trim().toLowerCase();
    return SPOTLIGHT_MAP[key] ?? current[idx];
  });
}

function buildImportRows(mapping: FieldKey[], dataRows: string[][]): ImportRow[] {
  return dataRows.map((cells) => {
    const fields: Partial<Record<Exclude<FieldKey, "">, string>> = {};
    const notesParts: string[] = [];

    mapping.forEach((field, idx) => {
      if (!field) return;
      const value = (cells[idx] ?? "").trim();
      if (!value) return;
      if (field === "notes") {
        notesParts.push(value);
      } else if (!fields[field]) {
        fields[field] = value;
      }
    });

    if (notesParts.length > 0) fields.notes = notesParts.join(" / ");

    return { name: fields.name ?? "", ...fields };
  });
}

const CHUNK_SIZE = 100;

export function ImportClient() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<FieldKey[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError("");
    try {
      const text = await decodeFile(file);
      const delimiter = detectDelimiter(text);
      const allRows = parseDelimited(text, delimiter);

      if (allRows.length < 1) {
        setError("Die Datei enthält keine Daten.");
        return;
      }

      const headerRow = allRows[0].map((h) => h.trim());
      const rows = allRows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));

      if (rows.length === 0) {
        setError("Die Datei enthält keine Datenzeilen.");
        return;
      }

      setHeaders(headerRow);
      setDataRows(rows);
      setMapping(headerRow.map(guessField));
      setFileName(file.name);
      setPhase("mapping");
    } catch {
      setError("Die Datei konnte nicht gelesen werden.");
    }
  }

  function resetAll() {
    setPhase("upload");
    setError("");
    setFileName("");
    setHeaders([]);
    setDataRows([]);
    setMapping([]);
    setProgress({ done: 0, total: 0 });
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const nameCount = mapping.filter((m) => m === "name").length;
  const canImport = nameCount === 1 && dataRows.length > 0;

  async function runImport() {
    setPhase("importing");
    const rows = buildImportRows(mapping, dataRows);
    setProgress({ done: 0, total: rows.length });

    let totalCreated = 0;
    let totalSkipped = 0;
    const allReasons: string[] = [];

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const res = await importDevicesAction(chunk);
      totalCreated += res.created;
      totalSkipped += res.skipped;
      for (const reason of res.skippedReasons) {
        if (allReasons.length < 10) allReasons.push(reason);
      }
      setProgress({ done: Math.min(i + CHUNK_SIZE, rows.length), total: rows.length });
    }

    await logImportSummaryAction(totalCreated, totalSkipped);

    setResult({ created: totalCreated, skipped: totalSkipped, skippedReasons: allReasons });
    setPhase("done");
  }

  return (
    <div className="flex flex-col gap-6">
      {phase === "upload" && (
        <div className="card flex flex-col gap-4">
          <h2 className="font-semibold">Schritt 1: Datei auswählen</h2>
          <p className="text-sm text-muted">
            Unterstützt werden .csv, .txt und .tsv — Trennzeichen und Zeichenkodierung werden
            automatisch erkannt.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.tsv,text/csv,text/plain"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            aria-label="CSV-Datei"
            className="input file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-foreground file:cursor-pointer"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      )}

      {phase === "mapping" && (
        <div className="card flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold">Schritt 2: Spalten zuordnen</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setMapping(applySpotlightTemplate(headers, mapping))}
              >
                Vectorworks Spotlight-Vorlage
              </button>
              <button type="button" className="btn-secondary" onClick={resetAll}>
                Andere Datei wählen
              </button>
            </div>
          </div>

          <p className="text-sm text-muted">
            {fileName} · {dataRows.length} Datenzeile(n) erkannt
          </p>

          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-muted text-left">
                <tr>
                  {headers.map((h, idx) => (
                    <th key={idx} className="px-3 py-2 font-medium align-top min-w-40">
                      <div className="mb-2 truncate" title={h}>
                        {h || `Spalte ${idx + 1}`}
                      </div>
                      <select
                        value={mapping[idx] ?? ""}
                        onChange={(e) => {
                          const next = [...mapping];
                          next[idx] = e.target.value as FieldKey;
                          setMapping(next);
                        }}
                        aria-label={`Feld für Spalte „${h || `Spalte ${idx + 1}`}“ zuordnen`}
                        className="input min-h-9 py-1 text-xs font-normal"
                      >
                        {FIELD_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {dataRows.slice(0, 5).map((row, rIdx) => (
                  <tr key={rIdx}>
                    {headers.map((_, cIdx) => (
                      <td key={cIdx} className="px-3 py-2 truncate max-w-40" title={row[cIdx] ?? ""}>
                        {row[cIdx] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {nameCount !== 1 && (
            <p className="text-sm text-amber-400">
              {nameCount === 0
                ? 'Bitte genau eine Spalte auf "Name" mappen.'
                : 'Nur eine Spalte darf auf "Name" gemappt werden.'}
            </p>
          )}

          <button
            type="button"
            disabled={!canImport}
            onClick={runImport}
            className="btn-primary md:self-start"
          >
            {dataRows.length} Geräte importieren
          </button>
        </div>
      )}

      {phase === "importing" && (
        <div className="card flex flex-col gap-3">
          <h2 className="font-semibold">Import läuft…</h2>
          <div className="h-3 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{
                width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%`,
              }}
            />
          </div>
          <p className="text-sm text-muted">
            {progress.done}/{progress.total} verarbeitet
          </p>
        </div>
      )}

      {phase === "done" && result && (
        <div className="card flex flex-col gap-4">
          <h2 className="font-semibold text-emerald-400">Import abgeschlossen</h2>
          <p>
            <span className="font-semibold">{result.created}</span> Geräte angelegt,{" "}
            <span className="font-semibold">{result.skipped}</span> übersprungen.
          </p>

          {result.skippedReasons.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted">Beispiele übersprungener Zeilen:</p>
              <ul className="text-sm text-muted list-disc list-inside">
                {result.skippedReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Link href="/geraete" className="btn-primary">
              Zur Geräteliste
            </Link>
            <button type="button" className="btn-secondary" onClick={resetAll}>
              Weitere Datei importieren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
