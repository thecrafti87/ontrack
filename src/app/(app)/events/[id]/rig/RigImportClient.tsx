"use client";

import { useRef, useState } from "react";
import { extractZipEntry } from "@/lib/mvr/zipSlice";
import { parseGeneralScene, type ParsedFixture } from "@/lib/mvr/parseScene";
import { importRigAction, logRigImportSummaryAction } from "./actions";

const DEFAULT_UNCHECK_PATTERN = /truss|traverse|szene|scene|support|deko|set/i;
const CHUNK_SIZE = 100;

type Phase = "upload" | "filter" | "importing" | "done";
type CountItem = { name: string; count: number };

function layerKey(f: ParsedFixture): string {
  return f.layerName?.trim() || "Ohne Layer";
}

export function RigImportClient({
  eventId,
  hasExistingRig,
  onDone,
  onCancel,
}: {
  eventId: string;
  hasExistingRig: boolean;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [fixtures, setFixtures] = useState<ParsedFixture[]>([]);
  const [layerCounts, setLayerCounts] = useState<CountItem[]>([]);
  const [classCounts, setClassCounts] = useState<CountItem[]>([]);
  const [checkedLayers, setCheckedLayers] = useState<Set<string>>(new Set());
  const [checkedClasses, setCheckedClasses] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{ total: number; matched: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError("");
    if (
      hasExistingRig &&
      !window.confirm(
        "Es ist bereits ein Rig importiert. Der neue Import ersetzt alle vorhandenen Rig-Daten dieses Events. Fortfahren?"
      )
    ) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      const xml = await extractZipEntry(file, "GeneralSceneDescription.xml");
      const scene = parseGeneralScene(xml);

      if (scene.fixtures.length === 0) {
        setError("Keine Fixtures in der Datei gefunden.");
        return;
      }

      const layerMap = new Map<string, number>();
      const classMap = new Map<string, number>();
      for (const f of scene.fixtures) {
        const layer = layerKey(f);
        layerMap.set(layer, (layerMap.get(layer) ?? 0) + 1);
        if (f.className) classMap.set(f.className, (classMap.get(f.className) ?? 0) + 1);
      }
      const layerList = Array.from(layerMap.entries()).map(([name, count]) => ({ name, count }));
      const classList = Array.from(classMap.entries()).map(([name, count]) => ({ name, count }));

      setFixtures(scene.fixtures);
      setLayerCounts(layerList);
      setClassCounts(classList);
      setCheckedLayers(
        new Set(layerList.filter((l) => !DEFAULT_UNCHECK_PATTERN.test(l.name)).map((l) => l.name))
      );
      setCheckedClasses(
        new Set(classList.filter((c) => !DEFAULT_UNCHECK_PATTERN.test(c.name)).map((c) => c.name))
      );
      setFileName(file.name);
      setPhase("filter");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Die Datei konnte nicht gelesen werden.");
    }
  }

  function toggleLayer(name: string) {
    setCheckedLayers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleClass(name: string) {
    setCheckedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const filteredFixtures = fixtures.filter((f) => {
    const layerOk = checkedLayers.has(layerKey(f));
    const classOk = !f.className || checkedClasses.has(f.className);
    return layerOk && classOk;
  });

  function resetAll() {
    setPhase("upload");
    setError("");
    setFileName("");
    setFixtures([]);
    setLayerCounts([]);
    setClassCounts([]);
    setCheckedLayers(new Set());
    setCheckedClasses(new Set());
    setProgress({ done: 0, total: 0 });
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function runImport() {
    setPhase("importing");
    setProgress({ done: 0, total: filteredFixtures.length });

    let totalCreated = 0;
    let totalMatched = 0;

    for (let i = 0; i < filteredFixtures.length; i += CHUNK_SIZE) {
      const chunk = filteredFixtures.slice(i, i + CHUNK_SIZE).map((f) => ({
        uuid: f.uuid,
        name: f.name,
        fixtureId: f.fixtureId,
        gdtfSpec: f.gdtfSpec,
        gdtfMode: f.gdtfMode,
        layerName: f.layerName,
        className: f.className,
        dmxAddresses: f.dmxAddresses,
        posX: f.posX,
        posY: f.posY,
        posZ: f.posZ,
      }));
      const res = await importRigAction(eventId, { filename: fileName }, chunk, i === 0);
      totalCreated += res.created;
      totalMatched += res.autoMatched;
      setProgress({ done: Math.min(i + CHUNK_SIZE, filteredFixtures.length), total: filteredFixtures.length });
    }

    await logRigImportSummaryAction(eventId, fileName, totalCreated);

    setResult({ total: totalCreated, matched: totalMatched });
    setPhase("done");
  }

  return (
    <div className="flex flex-col gap-6">
      {phase === "upload" && (
        <div className="card flex flex-col gap-4">
          <h2 className="font-semibold">Schritt 1: MVR-Datei auswählen</h2>
          <p className="text-sm text-muted">
            Vectorworks-Rig-Datei (.mvr) auswählen. Es wird ausschließlich die
            Szenenbeschreibung aus der ZIP-Datei gelesen — Ressourcen (GDTF/3D/Texturen)
            werden ignoriert, die Datei selbst wird nicht gespeichert. Funktioniert mit
            beliebig großen Dateien.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mvr"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            aria-label="MVR-Datei"
            className="input file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-foreground file:cursor-pointer"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          {onCancel && (
            <button type="button" className="btn-secondary md:self-start" onClick={onCancel}>
              Abbrechen
            </button>
          )}
        </div>
      )}

      {phase === "filter" && (
        <div className="card flex flex-col gap-4">
          <h2 className="font-semibold">Schritt 2: Filter</h2>
          <p className="text-sm text-muted">
            {fileName} · {fixtures.length} Fixtures gesamt
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="label mb-2">Layer</p>
              <div className="flex flex-col gap-1 max-h-60 overflow-y-auto rounded-xl border border-line p-2">
                {layerCounts.map((l) => (
                  <label
                    key={l.name}
                    className="flex items-center gap-2 text-sm p-1 rounded hover:bg-surface-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checkedLayers.has(l.name)}
                      onChange={() => toggleLayer(l.name)}
                      className="size-4"
                    />
                    {l.name} <span className="text-muted">({l.count})</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="label mb-2">Klassen</p>
              {classCounts.length === 0 ? (
                <p className="text-sm text-muted">Keine Klassen definiert.</p>
              ) : (
                <div className="flex flex-col gap-1 max-h-60 overflow-y-auto rounded-xl border border-line p-2">
                  {classCounts.map((c) => (
                    <label
                      key={c.name}
                      className="flex items-center gap-2 text-sm p-1 rounded hover:bg-surface-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checkedClasses.has(c.name)}
                        onChange={() => toggleClass(c.name)}
                        className="size-4"
                      />
                      {c.name} <span className="text-muted">({c.count})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="text-sm">
            <span className="font-semibold">{filteredFixtures.length}</span> von {fixtures.length} Fixtures
            werden importiert
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={filteredFixtures.length === 0}
              onClick={runImport}
              className="btn-primary"
            >
              Importieren
            </button>
            <button type="button" className="btn-secondary" onClick={resetAll}>
              Andere Datei wählen
            </button>
          </div>
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
            <span className="font-semibold">{result.total}</span> importiert, davon{" "}
            <span className="font-semibold">{result.matched}</span> automatisch zugeordnet.
          </p>
          <button type="button" className="btn-primary md:self-start" onClick={onDone}>
            Weiter zur Rig-Ansicht
          </button>
        </div>
      )}
    </div>
  );
}
