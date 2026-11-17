"use client";

import { ImagePlus } from "lucide-react";
import { ReminderList, type ReminderItem } from "./ReminderList";

export type ReminderCountry = ReminderItem & { code: string };

/**
 * On My World, while some countries have no photos: one chip each that goes
 * straight to adding them. Not every country needs photos: × takes one off.
 */
export function PhotoReminder({ countries }: { countries: ReminderCountry[] }) {
  return (
    <div className="mt-6">
      <ReminderList
        items={countries}
        icon={ImagePlus}
        title={(n) => (n === 1 ? "1 country is waiting for your photos" : `${n} countries are waiting for your photos`)}
        hint="Tap one to add photos. Not adding any? Tap × and it leaves this list."
        table="visited_countries"
        column="photo_reminder_off"
        ariaLabel="Countries waiting for photos"
      />
    </div>
  );
}
