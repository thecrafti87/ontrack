import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/constants";
import {
  LOAN_STATUS_BADGE,
  LOAN_STATUS_LABEL,
  loanStatus,
  tageUeberfaellig,
} from "@/lib/loan";
import { ReturnForm, DeleteLoanForm } from "../forms";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const loan = await prisma.loan.findUnique({ where: { id }, select: { borrower: true } });
  return loan ? { title: `Verleih an ${loan.borrower}` } : {};
}

export default async function VerleihDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const loan = await prisma.loan.findUnique({
    where: { id },
    include: {
      issuedBy: { select: { name: true } },
      items: {
        include: { device: { select: { id: true, name: true, inventoryNo: true } } },
        orderBy: { device: { inventoryNo: "asc" } },
      },
    },
  });

  if (!loan) notFound();

  const heute = new Date();
  const status = loanStatus(loan.dueAt, loan.returnedAt, heute);
  const verzug = tageUeberfaellig(loan.dueAt, loan.returnedAt, heute);
  const offen = loan.items.filter((i) => i.returnedAt == null);
  const zurueck = loan.items.filter((i) => i.returnedAt != null);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">{loan.borrower}</h1>
          <span className={`badge shrink-0 ${LOAN_STATUS_BADGE[status]}`}>
            {LOAN_STATUS_LABEL[status]}
          </span>
        </div>
        <p className="text-muted">
          Ausgegeben am {formatDate(loan.issuedAt)} von {loan.issuedBy.name} · zurück bis{" "}
          {formatDate(loan.dueAt)}
          {loan.returnedAt && <> · abgeschlossen am {formatDate(loan.returnedAt)}</>}
        </p>
        {loan.contact && <p className="text-sm">Kontakt: {loan.contact}</p>}
        {loan.notes && <p className="text-sm text-muted whitespace-pre-wrap">{loan.notes}</p>}
        {verzug > 0 && (
          <p className="text-sm text-red-400 font-medium">
            {verzug} {verzug === 1 ? "Tag" : "Tage"} über der Frist.
          </p>
        )}
      </div>

      {offen.length > 0 && (
        <div className="card flex flex-col gap-3">
          <p className="text-sm text-muted">
            {offen.length} von {loan.items.length} noch draußen
          </p>
          {canEdit(user) ? (
            <ReturnForm
              loanId={loan.id}
              offen={offen.map((i) => ({
                id: i.id,
                name: i.device.name,
                inventoryNo: i.device.inventoryNo,
              }))}
            />
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {offen.map((i) => (
                <li key={i.id}>
                  {i.device.name} <span className="text-muted font-mono">{i.device.inventoryNo}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {zurueck.length > 0 && (
        <div className="card flex flex-col gap-2">
          <h2 className="font-semibold">Zurückgenommen</h2>
          <ul className="flex flex-col divide-y divide-line text-sm">
            {zurueck.map((i) => (
              <li key={i.id} className="py-2 flex items-center justify-between gap-3">
                <Link href={`/geraete/${i.device.id}`} className="hover:underline">
                  {i.device.name}{" "}
                  <span className="text-muted font-mono">{i.device.inventoryNo}</span>
                </Link>
                <span className="text-muted shrink-0">{formatDateTime(i.returnedAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {user.role === "ADMIN" && (
        <div className="card border-red-500/30">
          <h2 className="font-semibold text-red-400 mb-3">Gefahrenzone</h2>
          <DeleteLoanForm id={loan.id} borrower={loan.borrower} />
        </div>
      )}
    </div>
  );
}
