import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import type { DeviceStatus } from "@/lib/constants";
import DeviceForm from "../../DeviceForm";
import { resolveActiveFieldCodes } from "../../actions";
import { DeleteDeviceForm } from "./DeleteDeviceForm";

export default async function EditDevicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canEdit(user)) redirect("/geraete");

  const { id } = await params;

  const [device, devices, locations, cases] = await Promise.all([
    prisma.device.findUnique({ where: { id } }),
    prisma.device.findMany({ select: { category: true } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.case.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!device) notFound();

  const categories = Array.from(
    new Set(devices.map((d) => d.category).filter((c): c is string => !!c))
  ).sort();

  const effectiveFieldCodes = await resolveActiveFieldCodes(device);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{device.name} bearbeiten</h1>
      <div className="card">
        <DeviceForm
          mode="edit"
          categories={categories}
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
          cases={cases.map((c) => ({ id: c.id, name: c.name }))}
          initial={{
            id: device.id,
            inventoryNo: device.inventoryNo,
            name: device.name,
            category: device.category,
            serialNo: device.serialNo,
            gtin: device.gtin,
            purchaseDate: device.purchaseDate ? device.purchaseDate.toISOString().slice(0, 10) : null,
            purchasePrice: device.purchasePrice,
            supplier: device.supplier,
            weightKg: device.weightKg,
            notes: device.notes,
            locationId: device.locationId,
            caseId: device.caseId,
            status: device.status as DeviceStatus,
          }}
          fieldsConfig={{
            hasOverride: device.fieldOverride != null,
            effectiveCodes: effectiveFieldCodes,
          }}
        />
      </div>

      {user.role === "ADMIN" && (
        <div className="card border-red-500/30">
          <h2 className="font-semibold text-red-400 mb-3">Gefahrenzone</h2>
          <DeleteDeviceForm deviceId={device.id} deviceName={device.name} />
        </div>
      )}
    </div>
  );
}
