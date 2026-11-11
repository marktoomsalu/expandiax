"use client";

import { useEffect } from "react";
import { rememberInvite } from "@/lib/invite";

/** On the join page: remembers who invited you, so signing up connects you two. */
export function RememberInvite({ username }: { username: string }) {
  useEffect(() => rememberInvite(username), [username]);
  return null;
}
