// Zentrale Status-Definitionen mit deutschen Labels und Farben (Tailwind-Klassen)

export const DEVICE_STATUS = {
  EINSATZBEREIT: { label: "Einsatzbereit", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  DEFEKT_GEMELDET: { label: "Defekt gemeldet", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  GESPERRT: { label: "Gesperrt", badge: "bg-red-500/15 text-red-400 border-red-500/30" },
  IN_REPARATUR: { label: "In Reparatur", badge: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  AUSGEMUSTERT: { label: "Ausgemustert", badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
} as const;
export type DeviceStatus = keyof typeof DEVICE_STATUS;

// Gesperrt/defekt/ausgemustert = nicht für Events einplanbar
export const NOT_PLANNABLE: DeviceStatus[] = ["DEFEKT_GEMELDET", "GESPERRT", "IN_REPARATUR", "AUSGEMUSTERT"];

export const EVENT_ITEM_STATUS = {
  GEPLANT: { label: "Geplant", badge: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30", next: "GEPACKT" },
  GEPACKT: { label: "Gepackt", badge: "bg-sky-500/15 text-sky-400 border-sky-500/30", next: "AUFGEBAUT" },
  AUFGEBAUT: { label: "Aufgebaut", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", next: "ABGEBAUT" },
  ABGEBAUT: { label: "Abgebaut", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30", next: "ZURUECK" },
  ZURUECK: { label: "Zurück im Lager", badge: "bg-violet-500/15 text-violet-400 border-violet-500/30", next: null },
} as const;
export type EventItemStatus = keyof typeof EVENT_ITEM_STATUS;

export const ISSUE_STATUS = {
  OFFEN: { label: "Offen", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  IN_REPARATUR: { label: "In Reparatur", badge: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  ERLEDIGT: { label: "Erledigt", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
} as const;
export type IssueStatus = keyof typeof ISSUE_STATUS;

/**
 * Ergebnis einer durchgeführten Prüfung.
 *
 * `resetsInterval` steuert, ob die Prüfung den Fälligkeitsstichtag weiterschiebt.
 * Eine nicht bestandene Prüfung tut das bewusst NICHT: das Gerät bleibt fällig,
 * bis es die Prüfung besteht — sonst hätte ein Durchfallen zur Folge, dass für
 * ein Jahr Ruhe ist.
 */
export const MAINTENANCE_RESULT = {
  BESTANDEN: {
    label: "Bestanden",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    resetsInterval: true,
  },
  MAENGEL: {
    label: "Bestanden, mit Mängeln",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    resetsInterval: true,
  },
  DURCHGEFALLEN: {
    label: "Nicht bestanden",
    badge: "bg-red-500/15 text-red-400 border-red-500/30",
    resetsInterval: false,
  },
} as const;
export type MaintenanceResult = keyof typeof MAINTENANCE_RESULT;

export function isMaintenanceResult(value: string): value is MaintenanceResult {
  return value in MAINTENANCE_RESULT;
}

/**
 * Die vier Phasen des Einsatzmodus.
 *
 * Sie bilden direkt auf die bestehenden Packlisten-Status ab — es gibt kein
 * zweites Statusmodell daneben. Eine Phase bedeutet: „jedes gescannte Gerät
 * bekommt diesen Status".
 */
export const MISSION_PHASES = {
  GEPACKT: {
    label: "Packen",
    /** Was am Gerät passiert, wenn es gescannt wird. */
    action: "eingepackt",
    hint: "Gerät scannen = eingepackt",
  },
  AUFGEBAUT: {
    label: "Aufbauen",
    action: "aufgebaut",
    hint: "Gerät scannen = aufgebaut",
  },
  ABGEBAUT: {
    label: "Abbauen",
    action: "abgebaut",
    hint: "Gerät scannen = abgebaut",
  },
  ZURUECK: {
    label: "Zurückräumen",
    action: "zurück im Lager",
    hint: "Gerät scannen = zurück im Lager",
  },
} as const;
export type MissionPhase = keyof typeof MISSION_PHASES;

export function isMissionPhase(value: string): value is MissionPhase {
  return value in MISSION_PHASES;
}

/** Die Phasen in der Reihenfolge, in der gearbeitet wird. */
export const MISSION_PHASE_ORDER = Object.keys(MISSION_PHASES) as MissionPhase[];

/**
 * Was nach dieser Phase drankommt — oder null nach der letzten.
 *
 * Ohne diese Auskunft endet ein Einsatz nie: Die Phase ist abgearbeitet, und
 * die App weiss nicht, was sie anbieten soll. Genau das ist passiert — ein
 * Einsatz „Abbauen" lief einen Tag lang weiter, weil es keinen Weg
 * vorwaerts und keinen hinaus gab.
 */
export function nextMissionPhase(phase: MissionPhase): MissionPhase | null {
  const stelle = MISSION_PHASE_ORDER.indexOf(phase);
  if (stelle < 0 || stelle >= MISSION_PHASE_ORDER.length - 1) return null;
  return MISSION_PHASE_ORDER[stelle + 1];
}

/**
 * Reihenfolge der Packlisten-Status als Zahl — geplant = 0 bis zurück = 4.
 *
 * Damit lässt sich beantworten, ob ein Gerät eine Phase schon hinter sich hat.
 * Ein bereits aufgebautes Gerät soll beim Packen-Scan nicht zurückgestuft
 * werden: Ein Scan darf nie rückwärts buchen.
 */
export function eventItemStatusRank(status: string): number {
  const reihenfolge: string[] = [];
  let aktuell: string | null = "GEPLANT";
  while (aktuell) {
    reihenfolge.push(aktuell);
    aktuell = EVENT_ITEM_STATUS[aktuell as EventItemStatus].next;
  }
  const index = reihenfolge.indexOf(status);
  return index === -1 ? 0 : index;
}

/** Hat das Gerät die Phase bereits erreicht oder überschritten? */
export function hasReachedPhase(itemStatus: string, phase: MissionPhase): boolean {
  return eventItemStatusRank(itemStatus) >= eventItemStatusRank(phase);
}

/**
 * Warum sich ein Bestand geändert hat.
 *
 * Der Bestand wird nie direkt gesetzt, sondern ergibt sich aus Bewegungen —
 * nur so lässt sich später beantworten, wohin die 40 Kabel gegangen sind.
 */
export const BULK_REASONS = {
  ENTNAHME: { label: "Entnahme", richtung: -1 as const },
  RUECKGABE: { label: "Rückgabe", richtung: 1 as const },
  ZUGANG: { label: "Zugang (neu beschafft)", richtung: 1 as const },
  KORREKTUR: { label: "Korrektur (Inventur)", richtung: 0 as const },
} as const;
export type BulkReason = keyof typeof BULK_REASONS;

export function isBulkReason(value: string): value is BulkReason {
  return value in BULK_REASONS;
}

/** Übliche Einheiten für Mengenartikel. */
export const BULK_UNITS = ["Stück", "m", "Rolle", "Paar", "Satz", "kg", "l"] as const;

export const ROLES = {
  ADMIN: { label: "Admin" },
  TECHNIKER: { label: "Techniker" },
  HELFER: { label: "Helfer (nur lesen + abhaken)" },
} as const;
export type Role = keyof typeof ROLES;

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** Zeitraum kompakt formatieren — bei eintägigem Zeitraum nur ein Datum. */
export function formatDateRange(start: Date | string, end: Date | string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (s.toDateString() === e.toDateString()) return formatDate(s);
  return `${formatDate(s)} – ${formatDate(e)}`;
}

export const NO_CATEGORY_LABEL = "Ohne Kategorie";

/** Ab dieser Gesamtzahl sind Kategorie-Gruppen (Case-Inhalt, Packliste) auf Desktop initial zugeklappt. */
export const GROUP_AUTOOPEN_THRESHOLD = 30;

/**
 * Gruppiert eine Liste nach Kategorie (Reihenfolge: alphabetisch, "Ohne Kategorie"
 * immer zuletzt). Dient der übersichtlichen Darstellung großer Bestände
 * (Case-Inhalt, Event-Packliste) als aufklappbare Gruppen statt flacher Listen.
 */
export function groupByCategory<T>(
  items: T[],
  getCategory: (item: T) => string | null | undefined
): { category: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = getCategory(item)?.trim() || NO_CATEGORY_LABEL;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      if (a === NO_CATEGORY_LABEL) return 1;
      if (b === NO_CATEGORY_LABEL) return -1;
      return a.localeCompare(b, "de");
    })
    .map(([category, groupItems]) => ({ category, items: groupItems }));
}
