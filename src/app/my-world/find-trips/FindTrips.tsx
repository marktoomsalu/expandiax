"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WorldScanFlow } from "@/components/worldScan/WorldScanFlow";
import { canScanPhotos } from "@/lib/photoScan";
import { markWorldScanned, saveWorld } from "@/lib/worldScan";

export function FindTrips({ userId, homeCode }: { userId: string; homeCode: string | null }) {
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);

  // Only in the iPhone app with the scanner (build 12 on); anywhere else, back to the map.
  useEffect(() => {
    const can = canScanPhotos();
    setOk(can);
    if (!can) router.replace("/my-world");
  }, [router]);

  if (!ok) return null;
  return (
    <WorldScanFlow
      mode="member"
      homeCode={homeCode}
      onManual={() => router.push("/my-world")}
      onKeep={async (world) => {
        markWorldScanned();
        await saveWorld(userId, world).catch(() => {});
        router.refresh();
      }}
    />
  );
}
