"use client";

import { Camera } from "lucide-react";
import { ReminderList, type ReminderItem } from "./ReminderList";

export type NudgeItem = ReminderItem;

/**
 * On your Events page, only while something's missing: "6 events are still
 * waiting for your memories", each with a way straight to the one to finish,
 * and × for one you don't mean to add anything to.
 */
export function MemoryNudge({ events, className = "mt-8" }: { events: NudgeItem[]; className?: string }) {
  return (
    <div className={className}>
      <ReminderList
        items={events}
        icon={Camera}
        title={(n) => (n === 1 ? "1 event is still waiting for your memories" : `${n} events are still waiting for your memories`)}
        hint="Tap one to add photos. Not adding any? Tap × and it leaves this list."
        table="events"
        column="memory_reminder_off"
        ariaLabel="Memories to finish"
      />
    </div>
  );
}
