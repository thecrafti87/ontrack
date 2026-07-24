import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import CaseForm from "../../CaseForm";
import { DeleteCaseForm } from "./DeleteCaseForm";

export default async function EditCasePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canEdit(user)) redirect("/cases");

  const { id } = await params;

  const [caseRecord, locations] = await Promise.all([
    prisma.case.findUnique({ where: { id } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!caseRecord) notFound();

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{caseRecord.name} bearbeiten</h1>
      <div className="card">
        <CaseForm
          mode="edit"
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
          initial={{
            id: caseRecord.id,
            inventoryNo: caseRecord.inventoryNo,
            name: caseRecord.name,
            description: caseRecord.description,
            locationId: caseRecord.locationId,
          }}
        />
      </div>

      {user.role === "ADMIN" && (
        <div className="card border-red-500/30">
          <h2 className="font-semibold text-red-400 mb-3">Gefahrenzone</h2>
          <p className="text-sm text-muted mb-3">
            Die Geräte in diesem Case bleiben erhalten, verlieren nur die Case-Zuordnung.
          </p>
          <DeleteCaseForm caseId={caseRecord.id} caseName={caseRecord.name} />
        </div>
      )}
    </div>
  );
}
