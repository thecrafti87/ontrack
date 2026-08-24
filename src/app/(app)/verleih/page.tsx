import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { formatDate } from "@/lib/constants";
import { LOAN_STATUS_BADGE, LOAN_STATUS_LABEL, loanStatus, offeneAnzahl, tageUeberfaellig } from "@/lib/loan";

export const metadata: Metadata = { title: "Verleih" };

/**
 * Was ist draußen — und was hätte längst zurück sein sollen.
 *
 * Überfälliges steht oben: Das ist der einzige Grund, diese Seite im Alltag
 * zu öffnen.
 */
export default async function VerleihPage() {
  const user = await requireUser();

  const loans = await prisma.loan.findMany({
    include: {
      items: { select: { returnedAt: true } },
      issuedBy: { select: { name: true } },
    },
    orderBy: [{ returnedAt: "asc" }, { dueAt: "asc" }],
  });

  const heute = new Date();
  const mitStatus = loans.map((l) => ({
    ...l,
    status: loanStatus(l.dueAt, l.returnedAt, heute),
    verzug: tageUeberfaellig(l.dueAt, l.returnedAt, heute),
    offen: offeneAnzahl(l.items),
  }));

  const laufend = mitStatus.filter((l) => l.status !== "zurueck");
  const erledigt = mitStatus.filter((l) => l.status === "zurueck").slice(0, 20);
  const ueberfaellig = laufend.filter((l) => l.status === "ueberfaellig");

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Verleih</h1>
        {canEdit(user) && (
          <Link href="/verleih/neu" className="btn-primary">
            + Herausgeben
          </Link>
        )}
      </div>

      {loans.length === 0 && (
        <p className="text-muted">
          Noch nichts verliehen. Hier werden Geräte erfasst, die an Personen oder
          Fremdfirmen herausgegeben wurden — mit Rückgabefrist.
        </p>
      )}

      {ueberfaellig.length > 0 && (
        <div className="card border-red-500/30 bg-red-500/10 flex flex-col gap-2">
          <h2 className="font-semibold text-red-300">Überfällig</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {ueberfaellig.map((l) => (
              <li key={l.id}>
                <Link href={`/verleih/${l.id}`} className="hover:underline">
                  {l.borrower} — {l.offen} {l.offen === 1 ? "Gerät" : "Geräte"}, {l.verzug}{" "}
                  {l.verzug === 1 ? "Tag" : "Tage"} über der Frist
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {laufend.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Draußen</h2>
          {laufend.map((l) => (
            <Link
              key={l.id}
              href={`/verleih/${l.id}`}
              className="rounded-xl border border-line px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-surface-2 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-semibold truncate">{l.borrower}</p>
                <p className="text-xs text-muted truncate">
                  {l.offen} von {l.items.length} offen · zurück bis {formatDate(l.dueAt)} ·
                  ausgegeben von {l.issuedBy.name}
                </p>
              </div>
              <span className={`badge shrink-0 ${LOAN_STATUS_BADGE[l.status]}`}>
                {LOAN_STATUS_LABEL[l.status]}
              </span>
            </Link>
          ))}
        </div>
      )}

      {erledigt.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
            Zurückgegeben
          </h2>
          {erledigt.map((l) => (
            <Link
              key={l.id}
              href={`/verleih/${l.id}`}
              className="rounded-xl border border-line px-3 py-2 flex items-center justify-between gap-3 text-sm hover:bg-surface-2 transition-colors"
            >
              <span className="truncate">
                {l.borrower}
                <span className="text-muted"> · {l.items.length} Geräte</span>
              </span>
              <span className="text-muted shrink-0">{formatDate(l.returnedAt)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
