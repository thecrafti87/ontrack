"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { recordScanAction } from "../actions";

export function ScanCapture({ deviceId }: { deviceId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"capturing" | "done">("capturing");

  useEffect(() => {
    let cancelled = false;

    function finish() {
      if (cancelled) return;
      setStatus("done");
      router.replace(`/geraete/${deviceId}`);
      router.refresh();
    }

    if (!("geolocation" in navigator)) {
      recordScanAction(deviceId, null, null).finally(finish);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        recordScanAction(deviceId, position.coords.latitude, position.coords.longitude).finally(finish);
      },
      () => {
        recordScanAction(deviceId, null, null).finally(finish);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  return (
    <div className="card bg-accent/10 border-accent/30 text-sm text-accent">
      {status === "capturing" ? "📍 Standort wird erfasst…" : "Scan erfasst"}
    </div>
  );
}
