import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { formatDate, type Role } from "@/lib/constants";
import {
  ApproveUserForm,
  RoleForm,
  DeactivateUserForm,
  DeleteUserForm,
  ResetPasswordForm,
} from "./forms";

export const metadata: Metadata = { title: "Benutzer" };

const STATUS_BADGE = {
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  waiting: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

export default async function BenutzerPage() {
  const currentUser = await requireRole("ADMIN");

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  const waitingCount = users.filter((u) => !u.approved).length;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Benutzer</h1>

      {waitingCount > 0 && (
        <div className="card bg-amber-500/10 border-amber-500/30 text-amber-300 text-sm font-semibold">
          {waitingCount} Benutzer warten auf Freischaltung
        </div>
      )}

      {/* Desktop: echte Tabelle */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">E-Mail</th>
              <th className="px-4 py-3 font-medium">Rolle</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Registriert am</th>
              <th className="px-4 py-3 font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => {
              const isSelf = u.id === currentUser.id;
              return (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-semibold">
                    {u.name}
                    {isSelf && <span className="text-muted font-normal"> (du)</span>}
                  </td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    <RoleForm userId={u.id} currentRole={u.role as Role} />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`badge ${u.approved ? STATUS_BADGE.approved : STATUS_BADGE.waiting}`}
                    >
                      {u.approved ? "Freigeschaltet" : "Wartet"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {!u.approved && <ApproveUserForm userId={u.id} />}
                      <ResetPasswordForm userId={u.id} userName={u.name} />
                      {!isSelf && u.approved && (
                        <DeactivateUserForm userId={u.id} userName={u.name} />
                      )}
                      {!isSelf && <DeleteUserForm userId={u.id} userName={u.name} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobil: Karten */}
      <div className="md:hidden flex flex-col gap-3">
        {users.map((u) => {
          const isSelf = u.id === currentUser.id;
          return (
            <div key={u.id} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">
                    {u.name}
                    {isSelf && <span className="text-muted font-normal"> (du)</span>}
                  </p>
                  <p className="text-sm text-muted truncate">{u.email}</p>
                </div>
                <span
                  className={`badge shrink-0 ${u.approved ? STATUS_BADGE.approved : STATUS_BADGE.waiting}`}
                >
                  {u.approved ? "Freigeschaltet" : "Wartet"}
                </span>
              </div>
              <p className="text-sm text-muted">Registriert am {formatDate(u.createdAt)}</p>
              <RoleForm userId={u.id} currentRole={u.role as Role} />
              <div className="flex flex-wrap gap-2">
                {!u.approved && <ApproveUserForm userId={u.id} />}
                <ResetPasswordForm userId={u.id} userName={u.name} />
                {!isSelf && u.approved && <DeactivateUserForm userId={u.id} userName={u.name} />}
                {!isSelf && <DeleteUserForm userId={u.id} userName={u.name} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
