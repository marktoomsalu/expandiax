"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * On the Notifications page: they're all read now (the page marked them),
 * so the bell's count goes at once, and the rest of the app catches up.
 */
export function NotificationsSeen() {
  const router = useRouter();
  useEffect(() => {
    window.dispatchEvent(new Event("expandiax:notifications-read"));
    router.refresh();
  }, [router]);
  return null;
}
