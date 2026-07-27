"use client";

import { useActionState } from "react";
import { DEVICE_STATUS, type DeviceStatus } from "@/lib/constants";
import {
  changeStatusAction,
  changeLocationAction,
  uploadPhotoAction,
  deletePhotoAction,
  type ActionState,
} from "../actions";

export function StatusChangeForm({
  deviceId,
  currentStatus,
}: {
  deviceId: string;
  currentStatus: DeviceStatus;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(changeStatusAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 md:flex-row md:items-center">
      <input type="hidden" name="deviceId" value={deviceId} />
      <select
        name="status"
        defaultValue={currentStatus}
        aria-label="Neuer Status"
        className="input md:max-w-xs"
      >
        {Object.entries(DEVICE_STATUS).map(([key, val]) => (
          <option key={key} value={key}>
            {val.label}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="btn-secondary">
        {pending ? "Ändert…" : "Status ändern"}
      </button>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}

export function LocationChangeForm({
  deviceId,
  currentLocationId,
  locations,
}: {
  deviceId: string;
  currentLocationId: string | null;
  locations: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(changeLocationAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 md:flex-row md:items-center">
      <input type="hidden" name="deviceId" value={deviceId} />
      <select
        name="locationId"
        defaultValue={currentLocationId ?? ""}
        aria-label="Standort"
        className="input md:max-w-xs"
      >
        <option value="">Kein Standort</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="btn-secondary">
        {pending ? "Ändert…" : "Standort ändern"}
      </button>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}

export function PhotoUploadForm({ deviceId }: { deviceId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(uploadPhotoAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 md:flex-row md:items-end">
      <input type="hidden" name="deviceId" value={deviceId} />
      <div className="flex-1">
        <label className="label" htmlFor="photo-file">
          Foto
        </label>
        <input
          id="photo-file"
          type="file"
          name="file"
          accept="image/*"
          capture="environment"
          required
          className="input"
        />
      </div>
      <div className="flex-1">
        <label className="label" htmlFor="photo-caption">
          Bildunterschrift
        </label>
        <input id="photo-caption" type="text" name="caption" placeholder="optional" className="input" />
      </div>
      {state?.error && <p className="text-sm text-red-400 md:hidden">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-secondary shrink-0">
        {pending ? "Lädt hoch…" : "Foto hochladen"}
      </button>
      {state?.error && <p className="text-sm text-red-400 hidden md:block md:basis-full">{state.error}</p>}
    </form>
  );
}

export function DeletePhotoForm({ photoId, deviceId }: { photoId: string; deviceId: string }) {
  const [, formAction, pending] = useActionState<ActionState, FormData>(deletePhotoAction, undefined);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Foto wirklich löschen?")) e.preventDefault();
      }}
      className="absolute top-1 right-1"
    >
      <input type="hidden" name="photoId" value={photoId} />
      <input type="hidden" name="deviceId" value={deviceId} />
      <button
        type="submit"
        disabled={pending}
        aria-label="Foto löschen"
        className="flex items-center justify-center size-7 rounded-full bg-black/70 text-white text-sm hover:bg-red-600"
      >
        ✕
      </button>
    </form>
  );
}
