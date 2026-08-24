"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import Link from "next/link";
import QrScanner from "@/components/QrScanner";
import { NfcReadButton } from "@/components/NfcReadButton";
import { MISSION_PHASES, type MissionPhase } from "@/lib/constants";
import {
  addToMissionAction,
  scanIntoMissionAction,
  type ScanOutcome,
} from "./actions";
import {
  dequeueScan,
  enqueueScan,
  pruneOtherQueues,
  queueKey,
  readQueue,
  type QueuedScan,
} from "@/lib/offlineQueue";

type Props = {
  missionId: string;
  phase: MissionPhase;
  eventId: string;
  eventName: string;
  erledigt: number;
  gesamt: number;
};

/**
 * Ein Eintrag im Verlauf. „Vorgemerkt" ist bewusst ein eigener Zustand und
 * nicht als Erfolg getarnt: Ohne Netz weiß niemand, ob das Gerät überhaupt zur
 * Packliste gehört — das entscheidet erst der Server beim Nachbuchen.
 */
type Anzeige =
  | { art: "server"; outcome: ScanOutcome }
  | { art: "vorgemerkt"; code: string }
  | { art: "nachgebucht"; outcome: ScanOutcome };

type Eintrag = {
  id: number;
  anzeige: Anzeige;
  zeit: string;
};

const QUEUE_EVENT = "ontrack:queue-changed";
const LEER: QueuedScan[] = [];

/**
 * Zwischenspeicher für den Momentaufnahme-Wert.
 *
 * useSyncExternalStore verlangt bei unveränderten Daten dieselbe Referenz —
 * sonst rendert React endlos. Verglichen wird der rohe JSON-Text.
 */
let queueCache: { missionId: string; roh: string; wert: QueuedScan[] } | null = null;

function queueSnapshot(missionId: string): QueuedScan[] {
  const roh = window.localStorage.getItem(queueKey(missionId)) ?? "";
  if (queueCache && queueCache.missionId === missionId && queueCache.roh === roh) {
    return queueCache.wert;
  }
  const wert = readQueue(window.localStorage, missionId);
  queueCache = { missionId, roh, wert };
  return wert;
}

/** Nach jeder Änderung an der Warteschlange melden. */
function meldeQueueAenderung() {
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

/**
 * Vorgemerkte Scans als externe Quelle.
 *
 * Der Browser-Speicher gehört genau dorthin: Der Server kennt ihn nicht und
 * liefert eine leere Liste, der Client den echten Stand — ohne Abweichung
 * beim Hydrieren und ohne Zustandssetzen in einem Effect.
 */
function useWartendeScans(missionId: string): QueuedScan[] {
  return useSyncExternalStore(
    (melde) => {
      window.addEventListener(QUEUE_EVENT, melde);
      window.addEventListener("storage", melde);
      return () => {
        window.removeEventListener(QUEUE_EVENT, melde);
        window.removeEventListener("storage", melde);
      };
    },
    () => queueSnapshot(missionId),
    () => LEER
  );
}

/**
 * Verbindungszustand als externe Quelle.
 *
 * useSyncExternalStore statt eines Effects: Der Server nimmt „online" an,
 * der Client meldet den echten Zustand — ohne Abweichung beim Hydrieren.
 */
function useOnline(): boolean {
  return useSyncExternalStore(
    (melde) => {
      window.addEventListener("online", melde);
      window.addEventListener("offline", melde);
      return () => {
        window.removeEventListener("online", melde);
        window.removeEventListener("offline", melde);
      };
    },
    () => navigator.onLine,
    () => true
  );
}

/**
 * Kurzer Ton als Rückmeldung.
 *
 * Beim Verladen schaut niemand auf den Bildschirm — man hört, ob der Scan
 * gesessen hat. Erzeugt statt einer Audiodatei, damit nichts nachgeladen
 * werden muss und es auch offline funktioniert.
 */
function tonAbspielen(art: "ok" | "schon" | "fehler") {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const jetzt = ctx.currentTime;
    const frequenz = art === "ok" ? 880 : art === "schon" ? 520 : 220;
    const dauer = art === "fehler" ? 0.32 : 0.12;

    osc.frequency.setValueAtTime(frequenz, jetzt);
    osc.type = art === "fehler" ? "sawtooth" : "sine";
    gain.gain.setValueAtTime(0.001, jetzt);
    gain.gain.exponentialRampToValueAtTime(0.25, jetzt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, jetzt + dauer);

    osc.start(jetzt);
    osc.stop(jetzt + dauer + 0.02);
    osc.onended = () => ctx.close();
  } catch {
    // Ton ist Beiwerk — ohne ihn funktioniert der Scan genauso.
  }
}

function vibrieren(art: "ok" | "schon" | "fehler") {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  navigator.vibrate(art === "fehler" ? [90, 60, 90] : art === "schon" ? 30 : 60);
}

function artVon(outcome: ScanOutcome): "ok" | "schon" | "fehler" {
  if (outcome.kind === "gebucht") return "ok";
  if (outcome.kind === "schon") return "schon";
  return "fehler";
}

function farbeVon(anzeige: Anzeige): string {
  if (anzeige.art === "vorgemerkt") {
    return "border-zinc-500/40 bg-zinc-500/10 text-zinc-300";
  }
  const outcome = anzeige.outcome;
  switch (outcome.kind) {
    case "gebucht":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "schon":
      return "border-sky-500/40 bg-sky-500/10 text-sky-300";
    case "fremd":
      return "border-amber-500/40 bg-amber-500/10 text-amber-300";
    default:
      return "border-red-500/40 bg-red-500/10 text-red-300";
  }
}

function textVon(anzeige: Anzeige, phase: MissionPhase): string {
  if (anzeige.art === "vorgemerkt") {
    return `${anzeige.code} vorgemerkt — wird nachgebucht, sobald wieder Netz da ist`;
  }
  const vorspann = anzeige.art === "nachgebucht" ? "Nachgebucht: " : "";
  const outcome = anzeige.outcome;
  switch (outcome.kind) {
    case "gebucht":
      return outcome.anzahl > 1
        ? `${vorspann}${outcome.name}: ${outcome.anzahl} Geräte ${MISSION_PHASES[phase].action}`
        : `${vorspann}${outcome.name} ${MISSION_PHASES[phase].action}`;
    case "schon":
      return `${vorspann}${outcome.name} war schon ${MISSION_PHASES[phase].action}`;
    case "fremd":
      return `${vorspann}${outcome.name} gehört nicht zu diesem Einsatz`;
    case "unbekannt":
      return `${vorspann}Unbekannter Code: ${outcome.code}`;
    case "fehler":
      return outcome.nachricht;
  }
}

export function EinsatzClient({
  missionId,
  phase,
  eventId,
  eventName,
  erledigt,
  gesamt,
}: Props) {
  const [stand, setStand] = useState({ erledigt, gesamt });
  const [eintraege, setEintraege] = useState<Eintrag[]>([]);
  const [manuell, setManuell] = useState("");
  const [, startTransition] = useTransition();
  const laufNr = useRef(0);
  const inArbeit = useRef(false);
  const amNachbuchen = useRef(false);

  const online = useOnline();
  const wartend = useWartendeScans(missionId);

  const protokolliere = useCallback((anzeige: Anzeige) => {
    laufNr.current += 1;
    setEintraege((bisher) =>
      [
        {
          id: laufNr.current,
          anzeige,
          zeit: new Date().toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        },
        ...bisher,
      ].slice(0, 12)
    );
  }, []);

  // Reste vergangener Einsätze aufräumen. Verändert nur den Browser-Speicher,
  // kein React-Zustand — genau das, wofür ein Effect gedacht ist.
  useEffect(() => {
    const entfernt = pruneOtherQueues(
      window.localStorage,
      missionId,
      Object.keys(window.localStorage)
    );
    if (entfernt.length > 0) meldeQueueAenderung();
  }, [missionId]);

  /**
   * Vorgemerkte Scans nachbuchen — in der Reihenfolge, in der gescannt wurde.
   *
   * Bricht beim ersten Fehlschlag ab und lässt den Rest stehen: Reißt die
   * Verbindung mitten im Nachbuchen wieder ab, darf nichts verloren gehen.
   *
   * Das Nachbuchen ist gefahrlos, weil ein Scan nie rückwärts bucht. Ein
   * Gerät, das inzwischen von jemand anderem gebucht wurde, meldet sich
   * schlicht als „war schon".
   */
  const nachbuchen = useCallback(async () => {
    if (amNachbuchen.current) return;
    amNachbuchen.current = true;

    try {
      let rest = readQueue(window.localStorage, missionId);
      while (rest.length > 0 && navigator.onLine) {
        const naechster = rest[0]!;
        try {
          const antwort = await scanIntoMissionAction(naechster.code);
          rest = dequeueScan(window.localStorage, missionId, naechster.id);
          meldeQueueAenderung();
          if (antwort.fortschritt) setStand(antwort.fortschritt);
          protokolliere({ art: "nachgebucht", outcome: antwort.outcome });
        } catch {
          // Verbindung wieder weg — Rest bleibt stehen.
          break;
        }
      }
    } finally {
      amNachbuchen.current = false;
    }
  }, [missionId, protokolliere]);

  // Sobald wieder Netz da ist, nachbuchen.
  useEffect(() => {
    if (online) void nachbuchen();
  }, [online, nachbuchen]);

  const verarbeite = useCallback(
    async (code: string) => {
      // Der Scanner feuert weiter, während der Server antwortet. Ohne diese
      // Sperre würde dasselbe Gerät mehrfach gebucht.
      if (inArbeit.current) return;
      inArbeit.current = true;

      const vormerken = () => {
        enqueueScan(window.localStorage, missionId, code, crypto.randomUUID(), Date.now());
        meldeQueueAenderung();
        // Eigener, tieferer Ton: Es ist etwas passiert, aber nicht gebucht.
        tonAbspielen("schon");
        vibrieren("schon");
        protokolliere({ art: "vorgemerkt", code: code.trim() });
      };

      try {
        if (!navigator.onLine) {
          vormerken();
          return;
        }

        const antwort = await scanIntoMissionAction(code);
        const art = artVon(antwort.outcome);
        tonAbspielen(art);
        vibrieren(art);
        if (antwort.fortschritt) setStand(antwort.fortschritt);
        protokolliere({ art: "server", outcome: antwort.outcome });
      } catch {
        // Die Verbindung ist während der Anfrage weggebrochen. Der Scan darf
        // deswegen nicht verloren gehen.
        vormerken();
      } finally {
        inArbeit.current = false;
      }
    },
    [missionId, protokolliere]
  );

  const nachtragen = (deviceId: string) => {
    startTransition(async () => {
      const antwort = await addToMissionAction(deviceId);
      tonAbspielen("ok");
      if (antwort.fortschritt) setStand(antwort.fortschritt);
      protokolliere({ art: "server", outcome: antwort.outcome });
    });
  };

  const prozent = stand.gesamt > 0 ? Math.round((stand.erledigt / stand.gesamt) * 100) : 0;
  const fertig = stand.gesamt > 0 && stand.erledigt === stand.gesamt;

  return (
    <div className="flex flex-col gap-4">
      {/* Fortschritt — das Wichtigste, immer sichtbar */}
      <div className="card flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{MISSION_PHASES[phase].label}</p>
            <p className="text-lg font-semibold leading-tight">{eventName}</p>
          </div>
          <p className="text-3xl font-bold tabular-nums shrink-0">
            {stand.erledigt}
            <span className="text-muted text-lg">/{stand.gesamt}</span>
          </p>
        </div>

        <div
          className="h-3 w-full rounded-full bg-surface-2 overflow-hidden"
          role="progressbar"
          aria-valuenow={stand.erledigt}
          aria-valuemin={0}
          aria-valuemax={stand.gesamt}
          aria-label={`${MISSION_PHASES[phase].label}: ${stand.erledigt} von ${stand.gesamt}`}
        >
          <div
            className={`h-full transition-all duration-300 ${fertig ? "bg-emerald-500" : "bg-accent"}`}
            style={{ width: `${prozent}%` }}
          />
        </div>

        {fertig && (
          <p className="text-sm text-emerald-400 font-medium">
            Alle Geräte {MISSION_PHASES[phase].action}.
          </p>
        )}
      </div>

      {/* Verbindungszustand — ohne diesen Streifen glaubt man, gebucht zu haben,
          während die Scans nur vorgemerkt sind. */}
      {(!online || wartend.length > 0) && (
        <div
          className={`card flex items-start gap-3 ${
            online
              ? "border-sky-500/40 bg-sky-500/10"
              : "border-amber-500/40 bg-amber-500/10"
          }`}
          role="status"
        >
          <span className="text-xl leading-none shrink-0" aria-hidden="true">
            {online ? "↻" : "⚡"}
          </span>
          <div className="text-sm">
            {online ? (
              <>
                <p className="font-semibold text-sky-300">
                  {wartend.length}{" "}
                  {wartend.length === 1 ? "Scan wird" : "Scans werden"} nachgebucht …
                </p>
                <p className="text-muted">Die Seite bitte offen lassen.</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-amber-300">Kein Netz — Scans werden vorgemerkt</p>
                <p className="text-amber-200/80">
                  {wartend.length === 0
                    ? "Weiterscannen geht. Gebucht wird, sobald wieder Verbindung besteht."
                    : `${wartend.length} ${
                        wartend.length === 1 ? "Scan wartet" : "Scans warten"
                      } auf die Buchung. Ohne Netz lässt sich nicht prüfen, ob die Geräte zur Packliste gehören — das entscheidet sich beim Nachbuchen.`}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Dauer-Scan */}
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted">{MISSION_PHASES[phase].hint} — es geht ohne Zwischenklick weiter.</p>
        <QrScanner onCode={verarbeite} />
        <NfcReadButton onCode={verarbeite} />
      </div>

      {/* Manuelle Eingabe als Rückfallebene */}
      <div className="card flex flex-col gap-3">
        <label className="label" htmlFor="einsatz-manuell">
          Ohne Kamera: Nummer eintippen
        </label>
        <div className="flex gap-3">
          <input
            id="einsatz-manuell"
            className="input flex-1"
            placeholder="z. B. OT-0001"
            value={manuell}
            onChange={(e) => setManuell(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const wert = manuell.trim();
              if (!wert) return;
              setManuell("");
              void verarbeite(wert);
            }}
          />
          <button
            type="button"
            className="btn-primary shrink-0"
            onClick={() => {
              const wert = manuell.trim();
              if (!wert) return;
              setManuell("");
              void verarbeite(wert);
            }}
          >
            Buchen
          </button>
        </div>
      </div>

      {/* Verlauf */}
      {eintraege.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">Zuletzt gescannt</h2>
          <ul className="flex flex-col gap-2">
            {eintraege.map((e) => (
              <li
                key={e.id}
                className={`rounded-xl border px-3 py-2.5 text-sm flex items-start justify-between gap-3 ${farbeVon(e.anzeige)}`}
              >
                <span>{textVon(e.anzeige, phase)}</span>
                <span className="flex items-center gap-2 shrink-0">
                  {e.anzeige.art !== "vorgemerkt" && e.anzeige.outcome.kind === "fremd" && (
                    <button
                      type="button"
                      className="underline whitespace-nowrap"
                      onClick={() => {
                        const a = e.anzeige;
                        if (a.art !== "vorgemerkt" && a.outcome.kind === "fremd") {
                          nachtragen(a.outcome.deviceId);
                        }
                      }}
                    >
                      aufnehmen
                    </button>
                  )}
                  <span className="tabular-nums opacity-70">{e.zeit}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link href={`/events/${eventId}`} className="btn-secondary text-center">
        Zur Packliste
      </Link>
    </div>
  );
}
