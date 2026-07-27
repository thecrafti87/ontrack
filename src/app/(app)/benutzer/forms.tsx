"use client";

import { useActionState } from "react";
import { ROLES, type Role } from "@/lib/constants";
import {
  approveUserAction,
  changeRoleAction,
  deactivateUserAction,
  deleteUserAction,
  type ActionState,
} from "./actions";

export function ApproveUserForm({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    approveUserAction,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={userId} />
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "…" : "Freischalten"}
      </button>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}

export function RoleForm({ userId, currentRole }: { userId: string; currentRole: Role }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    changeRoleAction,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={userId} />
      <select
        name="role"
        defaultValue={currentRole}
        aria-label="Rolle"
        className="input min-h-10 py-1 max-w-48"
      >
        {Object.entries(ROLES).map(([key, val]) => (
          <option key={key} value={key}>
            {val.label}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="btn-secondary shrink-0">
        {pending ? "…" : "Speichern"}
      </button>
      {state?.error && <p className="text-xs text-red-400 basis-full">{state.error}</p>}
    </form>
  );
}

export function DeactivateUserForm({ userId, userName }: { userId: string; userName: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deactivateUserAction,
    undefined
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Konto von "${userName}" wirklich deaktivieren?`)) e.preventDefault();
      }}
      className="flex flex-col gap-1"
    >
      <input type="hidden" name="id" value={userId} />
      <button type="submit" disabled={pending} className="btn-secondary">
        {pending ? "…" : "Deaktivieren"}
      </button>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}

export function DeleteUserForm({ userId, userName }: { userId: string; userName: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteUserAction,
    undefined
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Benutzer "${userName}" wirklich unwiderruflich löschen?`)) {
          e.preventDefault();
        }
      }}
      className="flex flex-col gap-1"
    >
      <input type="hidden" name="id" value={userId} />
      <button type="submit" disabled={pending} className="btn-danger">
        {pending ? "…" : "Löschen"}
      </button>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}
