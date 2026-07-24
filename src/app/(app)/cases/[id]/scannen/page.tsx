import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { ScanAssignClient } from "./ScanAssignClient";

export default async function CaseScanPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const caseRecord = await prisma.case.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!caseRecord) notFound();

  if (!canEdit(user)) redirect(`/cases/${id}`);

  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link href={`/cases/${caseRecord.id}`} className="text-sm text-accent">
          ← Zurück zu {caseRecord.name}
        </Link>
        <h1 className="text-2xl font-bold">Geräte einscannen → {caseRecord.name}</h1>
      </div>

      <ScanAssignClient caseId={caseRecord.id} />
    </div>
  );
}
