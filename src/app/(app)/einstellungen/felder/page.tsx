import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { parseFieldCodes } from "@/lib/fieldCatalog";
import { FieldConfigForm } from "./FieldConfigForm";

export default async function FieldConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  await requireRole("ADMIN");
  const { category: rawCategory } = await searchParams;

  const devices = await prisma.device.findMany({ select: { category: true } });
  const categories = Array.from(
    new Set(devices.map((d) => d.category).filter((c): c is string => !!c))
  ).sort();

  const category = (rawCategory ?? categories[0] ?? "").trim();

  const deviceCount = category ? devices.filter((d) => d.category === category).length : 0;

  const config = category
    ? await prisma.categoryFieldConfig.findUnique({ where: { category } })
    : null;

  const selectedCodes = parseFieldCodes(config?.fieldCodes ?? null) ?? [];

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/einstellungen" className="text-sm text-accent">
          ← Zurück zu Einstellungen
        </Link>
        <h1 className="text-2xl font-bold">Zusatzfelder pro Kategorie</h1>
        <p className="text-sm text-muted">
          Lege pro Gerätekategorie fest, welche technischen Zusatzfelder auf der Gerätedetailseite
          angezeigt und gepflegt werden können.
        </p>
      </div>

      <form method="get" className="card flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="label" htmlFor="category">
            Kategorie
          </label>
          <input
            id="category"
            name="category"
            className="input"
            list="category-options"
            defaultValue={category}
            placeholder="z. B. Licht"
          />
          <datalist id="category-options">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <button type="submit" className="btn-secondary shrink-0">
          Auswählen
        </button>
      </form>

      {category ? (
        <div className="card flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold">Kategorie „{category}“</h2>
            <span className="badge bg-surface-2 text-muted border-line">
              {deviceCount} Gerät(e) betroffen
            </span>
          </div>
          <FieldConfigForm category={category} selectedCodes={selectedCodes} />
        </div>
      ) : (
        <p className="text-muted text-sm">Bitte eine Kategorie eingeben oder auswählen.</p>
      )}
    </div>
  );
}
