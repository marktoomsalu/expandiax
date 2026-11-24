"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FromPhotos } from "@/components/fromPhotos/FromPhotos";
import { canScanPhotos } from "@/lib/photoScan";

/** "Discover my world": only in the iPhone app with the scanner (build 12 on); anywhere else, back to the map. */
export function FindTrips({ userId, homeCode, countryCodes }: { userId: string; homeCode: string | null; countryCodes: string[] }) {
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    const can = canScanPhotos();
    setOk(can);
    if (!can) router.replace("/my-world");
  }, [router]);

  if (!ok) return null;
  return <FromPhotos userId={userId} homeCode={homeCode} countryCodes={countryCodes} />;
}
