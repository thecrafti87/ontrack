"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EVENT_ITEM_STATUS, type EventItemStatus } from "@/lib/constants";
import { updatePlanPositionAction, removePlanPositionAction } from "../actions";

export type PlanItem = {
  id: string;
  deviceId: string;
  deviceName: string;
  inventoryNo: string;
  status: EventItemStatus;
  planX: number | null;
  planY: number | null;
};

const STATUS_DOT_COLORS: Record<EventItemStatus, string> = {
  GEPLANT: "bg-zinc-400",
  GEPACKT: "bg-sky-400",
  AUFGEBAUT: "bg-emerald-400",
  ABGEBAUT: "bg-amber-400",
  ZURUECK: "bg-violet-400",
};

const DRAG_THRESHOLD = 5;

function truncateName(name: string): string {
  return name.length > 16 ? `${name.slice(0, 16)}…` : name;
}

export function PlanBoard({
  planImageUrl,
  items,
  editable,
}: {
  eventId: string;
  planImageUrl: string | null;
  items: PlanItem[];
  editable: boolean;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ itemId: string; startX: number; startY: number; moved: boolean } | null>(
    null
  );

  const [localPositions, setLocalPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [placementItemId, setPlacementItemId] = useState<string | null>(null);
  const [popoverItemId, setPopoverItemId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const placed = items.filter((i) => i.planX != null && i.planY != null);
  const unplaced = items.filter((i) => i.planX == null || i.planY == null);
  const popoverItem = items.find((i) => i.id === popoverItemId) ?? null;

  function relativePosFromEvent(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    return { x, y };
  }

  async function commitPosition(itemId: string, x: number, y: number) {
    setSavingId(itemId);
    await updatePlanPositionAction(itemId, x, y);
    setSavingId(null);
    router.refresh();
  }

  function handleContainerClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!placementItemId) return;
    const pos = relativePosFromEvent(e.clientX, e.clientY);
    if (!pos) return;
    const itemId = placementItemId;
    setPlacementItemId(null);
    setLocalPositions((prev) => ({ ...prev, [itemId]: pos }));
    void commitPosition(itemId, pos.x, pos.y);
  }

  function handleMarkerPointerDown(e: React.PointerEvent<HTMLDivElement>, itemId: string) {
    if (!editable) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { itemId, startX: e.clientX, startY: e.clientY, moved: false };
  }

  function handleMarkerPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragState.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      drag.moved = true;
      setDraggingId(drag.itemId);
    }
    if (drag.moved) {
      const pos = relativePosFromEvent(e.clientX, e.clientY);
      if (pos) setLocalPositions((prev) => ({ ...prev, [drag.itemId]: pos }));
    }
  }

  function handleMarkerPointerUp(e: React.PointerEvent<HTMLDivElement>, itemId: string) {
    const drag = dragState.current;
    dragState.current = null;
    setDraggingId(null);
    if (!drag) return;
    if (drag.moved) {
      const pos = relativePosFromEvent(e.clientX, e.clientY) ?? localPositions[itemId];
      if (pos) void commitPosition(itemId, pos.x, pos.y);
    } else {
      setPopoverItemId(itemId);
    }
  }

  async function handleRemovePosition(itemId: string) {
    setPopoverItemId(null);
    await removePlanPositionAction(itemId);
    router.refresh();
  }

  if (!planImageUrl) {
    return <p className="text-muted text-sm">Noch kein Veranstaltungsplan hochgeladen.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {placementItemId && (
        <p className="text-sm text-accent">
          Tippe auf den Plan, um{" "}
          <strong>{items.find((i) => i.id === placementItemId)?.deviceName ?? "das Gerät"}</strong> zu
          platzieren.
        </p>
      )}

      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className={`relative w-full rounded-xl overflow-hidden border border-line select-none ${
          placementItemId ? "cursor-crosshair ring-2 ring-accent" : ""
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={planImageUrl}
          alt="Veranstaltungsplan"
          className="w-full h-auto block max-w-full"
          draggable={false}
        />

        {placed.map((item) => {
          const pos = localPositions[item.id] ?? { x: item.planX!, y: item.planY! };
          const isDragging = draggingId === item.id;
          return (
            <div
              key={item.id}
              onPointerDown={(e) => handleMarkerPointerDown(e, item.id)}
              onPointerMove={handleMarkerPointerMove}
              onPointerUp={(e) => handleMarkerPointerUp(e, item.id)}
              onClick={(e) => e.stopPropagation()}
              style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, touchAction: "none" }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 ${
                editable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
              } ${isDragging ? "z-20 scale-110" : "z-10"} ${savingId === item.id ? "opacity-60" : ""}`}
            >
              <span
                className={`block size-8 rounded-full border-2 border-surface shadow-lg shrink-0 ${STATUS_DOT_COLORS[item.status]}`}
              />
              <span className="max-w-[8rem] truncate text-xs font-medium bg-surface/90 text-foreground px-1.5 py-0.5 rounded">
                {truncateName(item.deviceName)}
              </span>
            </div>
          );
        })}
      </div>

      {popoverItem && (
        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">{popoverItem.deviceName}</p>
            <span className={`badge shrink-0 ${EVENT_ITEM_STATUS[popoverItem.status].badge}`}>
              {EVENT_ITEM_STATUS[popoverItem.status].label}
            </span>
          </div>
          <Link href={`/geraete/${popoverItem.deviceId}`} className="text-accent text-sm">
            Zum Gerät
          </Link>
          <div className="flex gap-2">
            {editable && (
              <button
                type="button"
                onClick={() => handleRemovePosition(popoverItem.id)}
                className="btn-secondary"
              >
                Position entfernen
              </button>
            )}
            <button type="button" onClick={() => setPopoverItemId(null)} className="btn-secondary">
              Schließen
            </button>
          </div>
        </div>
      )}

      {unplaced.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">Noch nicht platziert:</p>
          <div className="flex flex-wrap gap-2">
            {unplaced.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={!editable}
                onClick={() => setPlacementItemId((cur) => (cur === item.id ? null : item.id))}
                className={`badge cursor-pointer disabled:cursor-not-allowed ${
                  placementItemId === item.id
                    ? "bg-accent/20 text-accent border-accent/40"
                    : "bg-surface-2 text-muted border-line"
                }`}
              >
                {item.deviceName}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
