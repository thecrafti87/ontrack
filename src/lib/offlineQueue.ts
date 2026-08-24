/**
 * Warteschlange für Scans ohne Netz.
 *
 * Der Fall, um den es geht: Man steht im Hallenkeller, der Empfang bricht weg,
 * und das Verladen geht trotzdem weiter. Die Scans werden vorgemerkt und
 * nachgebucht, sobald wieder Netz da ist.
 *
 * Bewusst localStorage statt IndexedDB: Es geht um ein paar hundert kurze
 * Zeichenketten. Die synchrone, überschaubare Schnittstelle ist hier mehr wert
 * als die Kapazität, die niemand braucht.
 *
 * Der Speicher wird als Parameter hereingereicht, damit die Regeln ohne
 * Browser prüfbar bleiben.
 */

export type QueuedScan = {
  id: string;
  code: string;
  /** Zeitpunkt des Scans, nicht des Nachbuchens. */
  at: number;
};

/** Was von localStorage tatsächlich gebraucht wird. */
export type SimpleStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/**
 * Je Einsatz eine eigene Warteschlange.
 *
 * Wird der Einsatz gewechselt, sind vorgemerkte Scans des alten Einsatzes
 * bedeutungslos — sie würden sonst in der falschen Phase nachgebucht.
 */
export function queueKey(missionId: string): string {
  return `ontrack:scanqueue:${missionId}`;
}

export function readQueue(store: SimpleStorage, missionId: string): QueuedScan[] {
  const roh = store.getItem(queueKey(missionId));
  if (!roh) return [];

  try {
    const daten = JSON.parse(roh);
    if (!Array.isArray(daten)) return [];
    // Beschädigte Einträge einzeln aussortieren, statt die ganze
    // Warteschlange zu verwerfen — sie ist das einzige Protokoll der Arbeit,
    // die ohne Netz geleistet wurde.
    return daten.filter(
      (e): e is QueuedScan =>
        e != null &&
        typeof e.id === "string" &&
        typeof e.code === "string" &&
        typeof e.at === "number"
    );
  } catch {
    return [];
  }
}

function writeQueue(store: SimpleStorage, missionId: string, eintraege: QueuedScan[]): void {
  if (eintraege.length === 0) store.removeItem(queueKey(missionId));
  else store.setItem(queueKey(missionId), JSON.stringify(eintraege));
}

/**
 * Einen Scan vormerken.
 *
 * Kein Entfernen von Doppelten: Zweimal denselben Code zu scannen ist eine
 * Aussage über die Arbeit ("ich habe es zweimal in die Hand genommen"), und
 * der Server weist die zweite Buchung ohnehin als „war schon" aus. Stillen
 * Verlust eines Scans wäre schlimmer.
 */
export function enqueueScan(
  store: SimpleStorage,
  missionId: string,
  code: string,
  id: string,
  at: number
): QueuedScan[] {
  const bereinigt = code.trim();
  if (!bereinigt) return readQueue(store, missionId);

  const neu = [...readQueue(store, missionId), { id, code: bereinigt, at }];
  writeQueue(store, missionId, neu);
  return neu;
}

/** Einen nachgebuchten Scan austragen. */
export function dequeueScan(
  store: SimpleStorage,
  missionId: string,
  id: string
): QueuedScan[] {
  const rest = readQueue(store, missionId).filter((e) => e.id !== id);
  writeQueue(store, missionId, rest);
  return rest;
}

export function clearQueue(store: SimpleStorage, missionId: string): void {
  store.removeItem(queueKey(missionId));
}

/**
 * Warteschlangen anderer Einsätze aufräumen.
 *
 * Ohne das sammeln sich Reste vergangener Einsätze im Speicher an, die nie
 * wieder nachgebucht werden — und beim nächsten Einsatz irritieren.
 */
export function pruneOtherQueues(
  store: SimpleStorage,
  aktuelleMissionId: string | null,
  alleSchluessel: string[]
): string[] {
  const praefix = "ontrack:scanqueue:";
  const entfernt: string[] = [];

  for (const key of alleSchluessel) {
    if (!key.startsWith(praefix)) continue;
    if (aktuelleMissionId && key === queueKey(aktuelleMissionId)) continue;
    store.removeItem(key);
    entfernt.push(key);
  }

  return entfernt;
}
