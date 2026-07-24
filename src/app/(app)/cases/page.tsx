import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { CaseTableRow } from "./CaseTableRow";

export default async function CasesPage() {
  const user = await requireUser();

  const cases = await prisma.case.findMany({
    include: { location: true, _count: { select: { devices: true } } },
    orderBy: { name: "asc" },
  });

  const editable = canEdit(user);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Cases</h1>
        {editable && (
          <Link href="/cases/neu" className="btn-primary">
            + Neues Case
          </Link>
        )}
      </div>

      <p className="text-sm text-muted">{cases.length} Cases</p>

      {/* Desktop: echte Tabelle */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Inventarnr.</th>
              <th className="px-4 py-3 font-medium">Standort</th>
              <th className="px-4 py-3 font-medium">Anzahl Geräte</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {cases.map((c) => (
              <CaseTableRow key={c.id} href={`/cases/${c.id}`}>
                <td className="px-4 py-3 font-semibold">{c.name}</td>
                <td className="px-4 py-3 font-mono">{c.inventoryNo}</td>
                <td className="px-4 py-3">{c.location?.name ?? "–"}</td>
                <td className="px-4 py-3">{c._count.devices}</td>
              </CaseTableRow>
            ))}
          </tbody>
        </table>
        {cases.length === 0 && <p className="p-4 text-muted">Keine Cases gefunden.</p>}
      </div>

      {/* Mobil: Karten-Liste mit großen Touch-Targets */}
      <div className="md:hidden flex flex-col gap-2">
        {cases.length === 0 && <p className="text-muted">Keine Cases gefunden.</p>}
        {cases.map((c) => (
          <Link
            key={c.id}
            href={`/cases/${c.id}`}
            className="card flex items-center justify-between gap-3 min-h-16 hover:bg-surface-2 transition-colors"
          >
            <div className="min-w-0">
              <p className="font-semibold truncate">{c.name}</p>
              <p className="text-sm text-muted truncate">
                <span className="font-mono">{c.inventoryNo}</span>
                {c.location && <> · {c.location.name}</>}
              </p>
            </div>
            <span className="badge shrink-0 bg-surface-2 text-muted border-line">
              {c._count.devices} Gerät(e)
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
