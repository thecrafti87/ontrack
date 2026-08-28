"use client";

import { useState } from "react";
import Link from "next/link";
import QrScanner from "@/components/QrScanner";
import { NfcReadButton } from "@/components/NfcReadButton";
import {
  assignRigFixtureByScanAction,
  type ScanZuordnung,
  type ScanZuordnungArt,
} from "../actions";

/**
 * Montage erfassen, ohne das Handy wegzulegen.
 *
 * Die Reihenfolge ist die der Arbeit, nicht die der Datenbank: Man steht vor
 * einer Position, hat das Gerät in der Hand, scannt — und ist danach schon bei
 * der nächsten Position. Deshalb bleibt die Kamera offen und die Liste rückt
 * von selbst weiter.
 *
 * Was hier bewusst NICHT automatisch passiert: den Montagestatus zu setzen.
 * Zuordnen kann man auch im Lager beim Vorbereiten. Der Schalter dafür steht
 * offen sichtbar oben, nicht in einer Einstellung.
 */

type Fixture = {
  id: string;
  name: string;
  fixtureId: string | null;
  layerName: string | null;
  dmxAddresses: string | null;
  installStatus: string;
  zugeordnet: string | null;
};

const ART_STIL: Record<ScanZuordnungArt, string> = {
  zugeordnet: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  schon_dieses: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
  anderes_fixture: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  unbekannt: "border-red-500/40 bg-red-500/10 text-red-300",
  fehler: "border-red-500/40 bg-red-500/10 text-red-300",
};

function beschriftung(f: Fixture): string {
  const teile = [f.name];
  if (f.fixtureId) teile.push(`#${f.fixtureId}`);
  return teile.join(" ");
}

export function RigScanClient({
  eventId,
  eventName,
  fixtures: initial,
}: {
  eventId: string;
  eventName: string;
  fixtures: Fixture[];
}) {
  const [fixtures, setFixtures] = useState<Fixture[]>(initial);
  const [index, setIndex] = useState(() => {
    const offen = initial.findIndex((f) => !f.zugeordnet);
    return offen === -1 ? 0 : offen;
  });
  const [alsMontiert, setAlsMontiert] = useState(true);
  const [letzte, setLetzte] = useState<ScanZuordnung | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [manuell, setManuell] = useState("");

  const aktuell = fixtures[index];
  const offeneAnzahl = fixtures.filter((f) => !f.zugeordnet).length;

  function naechsteOffene(ab: number): number {
    for (let i = ab + 1; i < fixtures.length; i++) if (!fixtures[i]!.zugeordnet) return i;
    for (let i = 0; i <= ab && i < fixtures.length; i++) if (!fixtures[i]!.zugeordnet) return i;
    return ab;
  }

  async function verarbeite(code: string) {
    if (laeuft || !aktuell) return;
    setLaeuft(true);
    try {
      const ergebnis = await assignRigFixtureByScanAction(aktuell.id, code, alsMontiert);
      setLetzte(ergebnis);

      if (ergebnis.art === "zugeordnet" && ergebnis.geraet) {
        const geraet = ergebnis.geraet;
        const platz = index;
        setFixtures((vorher) =>
          vorher.map((f) =>
            f.id === aktuell.id
              ? {
                  ...f,
                  zugeordnet: `${geraet.inventoryNo} — ${geraet.name}`,
                  installStatus: alsMontiert ? "MONTIERT" : f.installStatus,
                }
              : f
          )
        );
        setIndex(naechsteOffene(platz));
      }
    } catch {
      setLetzte({
        art: "fehler",
        code,
        meldung: "Die Zuordnung ist nicht durchgekommen. Verbindung prüfen und erneut scannen.",
      });
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Rig scannen</h1>
          <p className="text-sm text-muted">
            {eventName} · {offeneAnzahl} von {fixtures.length} noch offen
          </p>
        </div>
        <Link href={`/events/${eventId}/rig`} className="btn-secondary">
          Fertig
        </Link>
      </div>

      {aktuell ? (
        <div className="card flex flex-col gap-2 border-accent/40">
          <p className="label">Jetzt an der Reihe</p>
          <p className="text-lg font-semibold">{beschriftung(aktuell)}</p>
          <p className="text-sm">
            {aktuell.layerName?.trim() || <span className="text-muted">Ohne Layer</span>}
            {aktuell.dmxAddresses && (
              <span className="text-muted font-mono"> · DMX {aktuell.dmxAddresses}</span>
            )}
          </p>
          {aktuell.zugeordnet && (
            <p className="text-sm text-muted">Bisher: {aktuell.zugeordnet}</p>
          )}
          <div className="flex gap-2 flex-wrap pt-1">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIndex(naechsteOffene(index))}
              disabled={offeneAnzahl === 0}
            >
              Überspringen
            </button>
          </div>
        </div>
      ) : (
        <p className="card text-sm text-muted">Keine Position ausgewählt.</p>
      )}

      <label className="card flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={alsMontiert}
          onChange={(e) => setAlsMontiert(e.target.checked)}
          className="size-5 mt-0.5"
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">Gleich als montiert erfassen</span>
          <span className="text-sm text-muted">
            Ausschalten, wenn im Lager vorbereitet wird — dann wird nur zugeordnet.
          </span>
        </span>
      </label>

      <QrScanner onCode={(text) => void verarbeite(text)} />

      <NfcReadButton onCode={(text) => void verarbeite(text)} />

      <div className="card flex flex-col gap-3">
        <label className="label" htmlFor="rig-scan-manuell">
          Oder Nummer eintippen
        </label>
        <div className="flex gap-2 flex-wrap">
          <input
            id="rig-scan-manuell"
            className="input flex-1 min-w-40 font-mono"
            placeholder="z. B. OT-0001"
            value={manuell}
            onChange={(e) => setManuell(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={laeuft || !manuell.trim()}
            onClick={() => {
              const wert = manuell.trim();
              if (!wert) return;
              setManuell("");
              void verarbeite(wert);
            }}
          >
            Zuordnen
          </button>
        </div>
      </div>

      {letzte && (
        <div className={`rounded-xl border p-3 text-sm ${ART_STIL[letzte.art]}`}>
          <p className="font-semibold">{letzte.meldung}</p>
          {letzte.art === "unbekannt" && (
            <p className="mt-1 opacity-80">
              Steht das Gerät überhaupt im Bestand? Sonst zuerst dort anlegen.
            </p>
          )}
          {letzte.art === "anderes_fixture" && (
            <p className="mt-1 opacity-80">
              Eine Lampe kann nicht an zwei Stellen hängen — dort erst lösen, dann hier scannen.
            </p>
          )}
        </div>
      )}

      <div className="card flex flex-col gap-2">
        <p className="label">Alle Positionen</p>
        <ul className="flex flex-col gap-1 max-h-80 overflow-y-auto">
          {fixtures.map((f, i) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm flex items-baseline justify-between gap-2 ${
                  i === index ? "bg-surface-2 ring-1 ring-accent/50" : "hover:bg-surface-2"
                }`}
              >
                <span className="min-w-0">
                  <span className="font-medium">{beschriftung(f)}</span>
                  {f.layerName && <span className="text-muted"> · {f.layerName}</span>}
                </span>
                <span className={`shrink-0 ${f.zugeordnet ? "text-emerald-400" : "text-muted"}`}>
                  {f.zugeordnet ?? "offen"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
