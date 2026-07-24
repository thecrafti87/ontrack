import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import CaseForm from "../CaseForm";

function nextInventoryNumber(existingNumbers: string[]): string {
  let max = 0;
  let digits = 4;
  for (const no of existingNumbers) {
    const match = /^CS-(\d+)$/.exec(no);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
      digits = Math.max(digits, match[1].length);
    }
  }
  const next = max + 1;
  return `CS-${String(next).padStart(digits, "0")}`;
}

export default async function NewCasePage() {
  const user = await requireUser();
  if (!canEdit(user)) redirect("/cases");

  const [cases, locations] = await Promise.all([
    prisma.case.findMany({ select: { inventoryNo: true } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
  ]);

  const suggestedNo = nextInventoryNumber(cases.map((c) => c.inventoryNo));

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Neues Case</h1>
      <div className="card">
        <CaseForm
          mode="create"
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
          nextInventoryNo={suggestedNo}
        />
      </div>
    </div>
  );
}
