// Eingebauter Feldkatalog für technische Zusatzfelder (bewusst mehr als in jeder
// Kategorie gebraucht wird — der Admin wählt pro Kategorie eine Teilmenge aus).
// Alle Werte werden als Freitext gespeichert (DeviceFieldValue.value: String).

export type FieldDef = {
  code: string;
  label: string;
  unit?: string;
  group: string;
};

export const FIELD_CATALOG: FieldDef[] = [
  // DMX & Steuerung
  { code: "dmxAddress", label: "DMX-Adresse", group: "DMX & Steuerung" },
  { code: "dmxUniverse", label: "DMX-Universum", group: "DMX & Steuerung" },
  { code: "dmxMode", label: "DMX-Modus", group: "DMX & Steuerung" },
  { code: "dmxChannels", label: "Kanalanzahl", group: "DMX & Steuerung" },
  { code: "protocol", label: "Steuerprotokoll", group: "DMX & Steuerung" },
  { code: "rdm", label: "RDM-fähig", group: "DMX & Steuerung" },

  // Strom
  { code: "powerW", label: "Leistung", unit: "W", group: "Strom" },
  { code: "voltage", label: "Spannung", unit: "V", group: "Strom" },
  { code: "currentA", label: "Stromaufnahme", unit: "A", group: "Strom" },
  { code: "plugType", label: "Anschlusstyp", group: "Strom" },
  { code: "powerThru", label: "Power-Durchgang", group: "Strom" },

  // Licht
  { code: "lampType", label: "Leuchtmittel", group: "Licht" },
  { code: "colorTempK", label: "Farbtemperatur", unit: "K", group: "Licht" },
  { code: "lumen", label: "Lichtstrom", unit: "lm", group: "Licht" },
  { code: "beamAngle", label: "Abstrahlwinkel", unit: "°", group: "Licht" },
  { code: "cri", label: "CRI", group: "Licht" },

  // Audio
  { code: "impedance", label: "Impedanz", unit: "Ohm", group: "Audio" },
  { code: "powerRms", label: "Belastbarkeit", unit: "W RMS", group: "Audio" },
  { code: "freqResponse", label: "Übertragungsbereich", group: "Audio" },
  { code: "connectors", label: "Anschlüsse", group: "Audio" },

  // Funk
  { code: "freqBand", label: "Frequenzband", group: "Funk" },
  { code: "rfChannel", label: "Funkkanal", group: "Funk" },
  { code: "rangeM", label: "Reichweite", unit: "m", group: "Funk" },
  { code: "licensed", label: "Anmeldepflichtig", group: "Funk" },

  // Rigging
  { code: "wll", label: "Traglast (WLL)", unit: "kg", group: "Rigging" },
  { code: "inspection", label: "Prüfung/TÜV bis", group: "Rigging" },
  { code: "material", label: "Material", group: "Rigging" },

  // Kabel
  { code: "lengthM", label: "Länge", unit: "m", group: "Kabel" },
  { code: "crossSection", label: "Querschnitt", unit: "mm²", group: "Kabel" },
  { code: "connectorType", label: "Steckertyp", group: "Kabel" },

  // Akku
  { code: "capacity", label: "Kapazität", group: "Akku" },
  { code: "runtime", label: "Laufzeit", unit: "h", group: "Akku" },
  { code: "chargeTime", label: "Ladezeit", unit: "h", group: "Akku" },

  // Allgemein
  { code: "firmware", label: "Firmware", group: "Allgemein" },
  { code: "yearBuilt", label: "Baujahr", group: "Allgemein" },
  { code: "dimensions", label: "Abmessungen", group: "Allgemein" },
  { code: "ipRating", label: "IP-Schutzklasse", group: "Allgemein" },
  { code: "accessories", label: "Zubehör", group: "Allgemein" },
];

/** Geordnete Liste aller Gruppennamen (Reihenfolge = erstes Vorkommen im Katalog). */
export const FIELD_GROUPS: string[] = Array.from(new Set(FIELD_CATALOG.map((f) => f.group)));

export function fieldByCode(code: string): FieldDef | undefined {
  return FIELD_CATALOG.find((f) => f.code === code);
}

/**
 * JSON-Array von Feld-Codes sicher parsen (z. B. CategoryFieldConfig.fieldCodes
 * oder Device.fieldOverride). Bei fehlendem/ungültigem Wert wird null zurückgegeben.
 */
export function parseFieldCodes(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((c): c is string => typeof c === "string");
    }
  } catch {
    // ungültiges JSON — ignorieren
  }
  return null;
}
