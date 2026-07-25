"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RigImportClient } from "./RigImportClient";

/**
 * Schaltet zwischen der Rig-Ansicht (Server-gerendert, als children übergeben)
 * und dem Import-Flow um. Nach abgeschlossenem Import wird per router.refresh()
 * frisch aus der DB nachgeladen.
 */
export function RigViewToggle({
  eventId,
  hasFixtures,
  editable,
  children,
}: {
  eventId: string;
  hasFixtures: boolean;
  editable: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [showImport, setShowImport] = useState(!hasFixtures && editable);

  if (!editable) return <>{children}</>;

  if (showImport) {
    return (
      <RigImportClient
        eventId={eventId}
        hasExistingRig={hasFixtures}
        onDone={() => {
          setShowImport(false);
          router.refresh();
        }}
        onCancel={hasFixtures ? () => setShowImport(false) : undefined}
      />
    );
  }

  return (
    <>
      {children}
      <button
        type="button"
        className="btn-secondary md:self-start"
        onClick={() => setShowImport(true)}
      >
        Neu importieren
      </button>
    </>
  );
}
