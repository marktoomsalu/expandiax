export type OnboardingStep = "cold-open" | "fork" | "home-country" | "countries" | "memory";

export type OnboardingMemory = {
  title: string;
  eventDate: string; // yyyy-mm-dd
  countryCode: string;
};

export type OnboardingDraft = {
  kind: "country" | "event" | null;
  homeCode: string | null;
  countryCodes: string[];
  memory: OnboardingMemory | null;
};

const STORAGE_KEY = "expandiax:onboarding-draft";

const EMPTY_DRAFT: OnboardingDraft = { kind: null, homeCode: null, countryCodes: [], memory: null };

export function loadDraft(): OnboardingDraft {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DRAFT;
    return { ...EMPTY_DRAFT, ...JSON.parse(raw) };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function saveDraft(draft: OnboardingDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage full/unavailable — the flow still works, just isn't resumable.
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

// Resuming mid-flow (killed tab, closed app) should land back on the step
// that matches what's actually in the draft, not always Screen 0.
export function stepForDraft(draft: OnboardingDraft): OnboardingStep {
  if (!draft.kind) return "cold-open";
  if (draft.kind === "country") return draft.homeCode ? "countries" : "home-country";
  return "memory";
}

// --- Pending memory photo -------------------------------------------------
// A File can't round-trip through sessionStorage (JSON-only), but it does
// need to survive the full-page navigation to /sign-up between picking it
// on the memory screen and there being a session to upload it under —
// IndexedDB (unlike session/localStorage) can actually store a File/Blob.
const DB_NAME = "expandiax-onboarding";
const STORE_NAME = "pending-photo";
const PHOTO_KEY = "photo";

function openPhotoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePendingPhoto(file: File): Promise<void> {
  const db = await openPhotoDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(file, PHOTO_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadPendingPhoto(): Promise<File | null> {
  const db = await openPhotoDb();
  const file = await new Promise<File | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(PHOTO_KEY);
    req.onsuccess = () => resolve((req.result as File) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return file;
}

export async function clearPendingPhoto(): Promise<void> {
  const db = await openPhotoDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(PHOTO_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
