"use client";

import { useEffect } from "react";
import { rememberInvite, rememberMoment } from "@/lib/invite";

/** On the join page: remembers who invited you (and to which trip or event), so signing up connects you. */
export function RememberInvite({ username, moment }: { username: string; moment?: string | null }) {
  useEffect(() => {
    rememberInvite(username);
    if (moment) rememberMoment(moment);
  }, [username, moment]);
  return null;
}
