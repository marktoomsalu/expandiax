"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Drafts: a memory being written is kept on the device as it's written, so
// leaving the app, losing the connection or a page reload never loses it.
// The words go to localStorage; the chosen photos and videos to IndexedDB
// (they're files). A draft lasts until it's saved for real or discarded,
// and unfinished ones are listed (Events, Countries) to carry on with.

export type DraftKind = "event" | "trip";

export type DraftMeta = {
  key: string;
  kind: DraftKind;
  /** "Coldplay", "Trip to Italy": what the list calls it. */
  title: string;
  /** Where to carry on. */
  href: string;
  savedAt: number;
  /** An unsaved change to something already saved, rather than a new memory. */
  editing?: boolean;
  files?: number;
};

const PREFIX = "expandiax:draft:";
const INDEX = "expandiax:drafts";
// A draft nobody came back to in this long is let go.
const MAX_AGE = 60 * 86_400_000;

function readIndex(): DraftMeta[] {
  try {
    const list = JSON.parse(localStorage.getItem(INDEX) ?? "[]") as DraftMeta[];
    return Array.isArray(list) ? list.filter((d) => Date.now() - d.savedAt < MAX_AGE) : [];
  } catch {
    return [];
  }
}

function writeIndex(list: DraftMeta[]) {
  try {
    localStorage.setItem(INDEX, JSON.stringify(list));
    window.dispatchEvent(new Event("expandiax:drafts"));
  } catch {
    /* storage full or blocked: nothing more to do */
  }
}

export function listDrafts(kind?: DraftKind): DraftMeta[] {
  return readIndex()
    .filter((d) => !kind || d.kind === kind)
    .sort((a, b) => b.savedAt - a.savedAt);
}

export function loadDraft<T>(key: string): { data: T; meta: DraftMeta } | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    const meta = readIndex().find((d) => d.key === key);
    return raw && meta ? { data: JSON.parse(raw) as T, meta } : null;
  } catch {
    return null;
  }
}

export function saveDraft(meta: Omit<DraftMeta, "savedAt">, data: unknown) {
  try {
    localStorage.setItem(PREFIX + meta.key, JSON.stringify(data));
    writeIndex([...readIndex().filter((d) => d.key !== meta.key), { ...meta, savedAt: Date.now() }]);
  } catch {
    /* storage full or blocked */
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
  writeIndex(readIndex().filter((d) => d.key !== key));
  void deleteFiles(key);
}

/** A new draft's id, for its address (?draft=…), so it can be found again. */
export const newDraftId = () => Math.random().toString(36).slice(2, 10);

// ---- Photos and videos (IndexedDB) -------------------------------------

export type DraftFile = { file: File; kind: "image" | "video" };

const DB = "expandiax-drafts";
const STORE = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = work(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

type StoredFile = { blob: Blob; name: string; type: string; kind: "image" | "video"; lastModified: number };

export async function saveDraftFiles(key: string, files: DraftFile[]) {
  try {
    if (!files.length) {
      await deleteFiles(key);
    } else {
      const stored: StoredFile[] = files.map(({ file, kind }) => ({ blob: file, name: file.name, type: file.type, kind, lastModified: file.lastModified }));
      await withStore("readwrite", (s) => s.put(stored, key));
    }
  } catch {
    /* no IndexedDB (private mode): the words are still kept */
  }
}

export async function loadDraftFiles(key: string): Promise<DraftFile[]> {
  try {
    const stored = (await withStore<StoredFile[] | undefined>("readonly", (s) => s.get(key))) ?? [];
    return stored.map((f) => ({ kind: f.kind, file: new File([f.blob], f.name, { type: f.type, lastModified: f.lastModified }) }));
  } catch {
    return [];
  }
}

async function deleteFiles(key: string) {
  try {
    await withStore("readwrite", (s) => s.delete(key));
  } catch {
    /* ignore */
  }
}

// ---- The hook the forms use ---------------------------------------------

/**
 * Keeps `value` as a draft under `meta.key` while `hasContent` says there's
 * something worth keeping (and lets it go when there isn't). On first
 * render, a draft left from before is handed to `restore` once. Saves a
 * moment after each change, and straight away when the app goes to the
 * background.
 */
export function useDraft<T>({
  meta,
  value,
  hasContent,
  restore,
  enabled = true,
}: {
  meta: Omit<DraftMeta, "savedAt">;
  value: T;
  hasContent: boolean;
  restore: (data: T, savedAt: number) => void;
  enabled?: boolean;
}) {
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const ready = useRef(false);
  // Just brought back: its photos may still be on their way from storage, so
  // an empty-looking form doesn't mean "let it go" yet.
  const restoredAtRef = useRef(0);
  // Saved for real (or thrown away) as it is now: nothing to keep until it changes again.
  const doneWith = useRef<string | null>(null);
  const latest = useRef({ meta, value, hasContent });
  latest.current = { meta, value, hasContent };

  useEffect(() => {
    if (!enabled) return;
    const found = loadDraft<T>(meta.key);
    if (found) {
      restoredAtRef.current = Date.now();
      restore(found.data, found.meta.savedAt);
      setRestoredAt(found.meta.savedAt);
    }
    ready.current = true;
    // Once, for this draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.key, enabled]);

  const flush = useCallback(() => {
    if (!enabled || !ready.current) return;
    const { meta: m, value: v, hasContent: has } = latest.current;
    if (doneWith.current !== null) {
      if (JSON.stringify(v) === doneWith.current) return;
      doneWith.current = null;
    }
    if (has) saveDraft(m, v);
    else if (Date.now() - restoredAtRef.current > 5000 && loadDraft(m.key)) clearDraft(m.key);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !ready.current) return;
    const t = setTimeout(flush, 500);
    return () => clearTimeout(t);
  }, [value, hasContent, flush, enabled]);

  useEffect(() => {
    const away = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", away);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", away);
      window.removeEventListener("pagehide", flush);
    };
  }, [flush]);

  return {
    /** When the draft shown was saved, if one was brought back. */
    restoredAt,
    /** Keep it now (the "Save as draft" button). */
    saveNow: () => {
      ready.current = true;
      doneWith.current = null;
      saveDraft(latest.current.meta, latest.current.value);
    },
    /** Saved for real, or thrown away. */
    discard: () => {
      doneWith.current = JSON.stringify(latest.current.value);
      clearDraft(meta.key);
      setRestoredAt(null);
    },
  };
}

/** Photos and videos picked in a form, kept with its draft (and brought back with it). */
export function useDraftFiles<T extends { file: File; kind: "image" | "video" }>(key: string, items: T[], restore: (files: DraftFile[]) => void, enabled = true) {
  const ready = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void loadDraftFiles(key).then((files) => {
      if (live && files.length) restore(files);
      ready.current = true;
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  useEffect(() => {
    if (!enabled || !ready.current) return;
    void saveDraftFiles(key, items.map((i) => ({ file: i.file, kind: i.kind })));
  }, [key, items, enabled]);
}

export function savedAgo(at: number, now = Date.now()) {
  const mins = Math.round((now - at) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
