import type { Plan } from "./types";

export const PHOTO_CAP: Record<Plan, number> = { free: 5, premium: 15 };
export const VIDEO_CAP: Record<Plan, number> = { free: 3, premium: 8 };
export const COUNTRY_CAP: Record<Plan, number | null> = { free: 40, premium: null };
export const EVENT_CAP: Record<Plan, number | null> = { free: 20, premium: null };
