/**
 * Parser für den Inhalt von "GeneralSceneDescription.xml" (MVR — My Virtual Rig).
 * Läuft im Browser (DOMParser). Es werden ausschließlich Fixture-Elemente
 * übernommen; alles andere (Truss, SceneObject, Support, VideoScreen, …) wird
 * nur (rekursiv durch GroupObjects hindurch) traversiert, aber nicht importiert.
 */

export type ParsedFixture = {
  uuid: string;
  name: string;
  fixtureId: string | null;
  gdtfSpec: string | null;
  gdtfMode: string | null;
  layerName: string | null;
  className: string | null;
  dmxAddresses: string | null;
  posX: number | null;
  posY: number | null;
  posZ: number | null;
};

export type ParsedScene = {
  fixtures: ParsedFixture[];
  layers: string[];
  classes: string[];
};

// ── 4x4-Affintransformation (row-major, homogene Koordinaten) ───────────────

type Mat4 = number[]; // Länge 16

function identity(): Mat4 {
  // prettier-ignore
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

/** MVR-Matrixtext "{ax,ay,az}{bx,by,bz}{cx,cy,cz}{ox,oy,oz}" parsen (Spalten a,b,c,o). */
function parseMatrixText(text: string | null | undefined): Mat4 {
  if (!text) return identity();
  const groups = [...text.trim().matchAll(/\{([^}]*)\}/g)].map((m) => m[1]);
  if (groups.length !== 4) return identity();

  const cols = groups.map((g) => g.split(",").map((n) => parseFloat(n.trim())));
  if (cols.some((c) => c.length !== 3 || c.some((n) => Number.isNaN(n)))) return identity();

  const [a, b, c, o] = cols;
  // prettier-ignore
  return [
    a[0], b[0], c[0], o[0],
    a[1], b[1], c[1], o[1],
    a[2], b[2], c[2], o[2],
    0,    0,    0,    1,
  ];
}

/** Volle affine Matrixmultiplikation A·B (B wird zuerst angewendet, dann A). */
function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array(16).fill(0);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[row * 4 + k] * b[k * 4 + col];
      out[row * 4 + col] = sum;
    }
  }
  return out;
}

function translationOf(m: Mat4): { x: number; y: number; z: number } {
  return { x: m[3], y: m[7], z: m[11] };
}

// ── XML-Hilfsfunktionen (nur direkte Kinder, tolerant gegenüber fehlenden Elementen) ──

function directChildren(el: Element, tag: string): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i];
    if (c.tagName === tag || c.localName === tag) out.push(c);
  }
  return out;
}

function directChild(el: Element, tag: string): Element | null {
  return directChildren(el, tag)[0] ?? null;
}

function textOf(el: Element | null): string | null {
  const t = el?.textContent?.trim();
  return t ? t : null;
}

// ── Fixture-Parsing ──────────────────────────────────────────────────────────

function parseAddresses(fixtureEl: Element): string | null {
  const addressesEl = directChild(fixtureEl, "Addresses");
  if (!addressesEl) return null;

  const parts: string[] = [];
  for (const addrEl of directChildren(addressesEl, "Address")) {
    const raw = addrEl.textContent?.trim();
    if (!raw) continue;
    const absolute = parseInt(raw, 10);
    if (!Number.isFinite(absolute) || absolute < 1) continue;
    const universe = Math.floor((absolute - 1) / 512) + 1;
    const address = ((absolute - 1) % 512) + 1;
    parts.push(`${universe}.${address}`);
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

function parseFixtureElement(
  el: Element,
  parentMatrix: Mat4,
  layerName: string,
  classMap: Map<string, string>
): ParsedFixture {
  const name = el.getAttribute("name") ?? "";
  const uuid = el.getAttribute("uuid") ?? "";

  const localMatrix = parseMatrixText(directChild(el, "Matrix")?.textContent);
  const world = multiply(parentMatrix, localMatrix);
  const t = translationOf(world);

  const fixtureId = textOf(directChild(el, "FixtureID"));

  let gdtfSpec = textOf(directChild(el, "GDTFSpec"));
  if (gdtfSpec && gdtfSpec.toLowerCase().endsWith(".gdtf")) {
    gdtfSpec = gdtfSpec.slice(0, -".gdtf".length);
  }

  const gdtfMode = textOf(directChild(el, "GDTFMode"));

  const classUuid = textOf(directChild(el, "Classing"));
  const className = classUuid ? (classMap.get(classUuid.toLowerCase()) ?? null) : null;

  const dmxAddresses = parseAddresses(el);

  return {
    uuid,
    name,
    fixtureId,
    gdtfSpec,
    gdtfMode,
    layerName,
    className,
    dmxAddresses,
    posX: t.x / 1000,
    posY: t.y / 1000,
    posZ: t.z / 1000,
  };
}

/** Rekursive Traversierung: nur Fixture übernehmen, nur durch GroupObject weiter absteigen. */
function traverseChildren(
  container: Element,
  parentMatrix: Mat4,
  layerName: string,
  classMap: Map<string, string>,
  fixtures: ParsedFixture[]
): void {
  for (let i = 0; i < container.children.length; i++) {
    const el = container.children[i];
    const tag = el.tagName || el.localName;

    if (tag === "Fixture") {
      fixtures.push(parseFixtureElement(el, parentMatrix, layerName, classMap));
    } else if (tag === "GroupObject") {
      const localMatrix = parseMatrixText(directChild(el, "Matrix")?.textContent);
      const combined = multiply(parentMatrix, localMatrix);
      const childList = directChild(el, "ChildList");
      if (childList) traverseChildren(childList, combined, layerName, classMap, fixtures);
    }
    // Truss, SceneObject, Support, VideoScreen, … werden bewusst ignoriert (nicht traversiert).
  }
}

/**
 * Parst den Inhalt von GeneralSceneDescription.xml. Wirft bei ungültigem XML
 * eine Fehlermeldung; fehlende/optionale Elemente werden toleriert.
 */
export function parseGeneralScene(xml: string): ParsedScene {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");

  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("GeneralSceneDescription.xml ist kein gültiges XML.");
  }

  const root = doc.documentElement;
  if (!root) throw new Error("GeneralSceneDescription.xml hat kein gültiges Wurzelelement.");

  // Klassen: GeneralSceneDescription > AUXData > Class(uuid, name)
  const classMap = new Map<string, string>();
  const auxData = directChild(root, "AUXData");
  if (auxData) {
    for (const classEl of directChildren(auxData, "Class")) {
      const uuid = classEl.getAttribute("uuid");
      const name = classEl.getAttribute("name");
      if (uuid && name) classMap.set(uuid.toLowerCase(), name);
    }
  }

  const fixtures: ParsedFixture[] = [];
  const layerNames = new Set<string>();

  const scene = directChild(root, "Scene");
  const layersEl = scene ? directChild(scene, "Layers") : null;
  if (layersEl) {
    for (const layerEl of directChildren(layersEl, "Layer")) {
      const layerName = layerEl.getAttribute("name") ?? "";
      layerNames.add(layerName);
      const layerMatrix = parseMatrixText(directChild(layerEl, "Matrix")?.textContent);
      const childList = directChild(layerEl, "ChildList");
      if (childList) traverseChildren(childList, layerMatrix, layerName, classMap, fixtures);
    }
  }

  const classNames = new Set<string>();
  for (const f of fixtures) if (f.className) classNames.add(f.className);

  return {
    fixtures,
    layers: Array.from(layerNames).sort((a, b) => a.localeCompare(b, "de")),
    classes: Array.from(classNames).sort((a, b) => a.localeCompare(b, "de")),
  };
}
