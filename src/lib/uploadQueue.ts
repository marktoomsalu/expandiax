import { createClient } from "@/lib/supabase/client";
import { storagePath } from "@/lib/media";
import { stripMediaMetadata } from "@/lib/mediaMetadata";
import { preparePhoto } from "@/lib/photoPrepare";

// Photos and videos upload in the background: a trip or event is saved and
// opened the moment you tap Save, and its memories follow while you carry
// on. Three at a time; photos shrunk on the device first; one video
// compressed at a time; retried on a bad connection; and kept on the device
// (IndexedDB) so an upload cut off by closing the app picks up next time.

export type CoverTable = "country_visits" | "events" | "visited_countries";

export type UploadTarget = {
  userId: string;
  scope: "countries" | "events";
  /** The trip or event — its page shows these uploads until they're in. */
  parentId: string;
  table: "country_media" | "event_media";
  /** Columns for the new row: the parent's id(s), and the trip place if known. */
  fields: Record<string, string>;
  displayOrder: number;
  caption?: string;
  videoQuality?: "standard" | "hd";
  /** Make this the cover once it's in. */
  cover?: { table: CoverTable; id: string };
};

export type UploadStatus = "waiting" | "preparing" | "uploading" | "retrying" | "done" | "failed";

export type UploadJob = {
  id: string;
  file: File;
  kind: "image" | "video";
  target: UploadTarget;
  status: UploadStatus;
  progress: number; // 0–100 within the current step
  error?: string;
  previewUrl: string;
  attempts: number;
};

const CONCURRENCY = 3;
const RETRY_DELAYS = [2000, 6000, 15000];

let jobs: UploadJob[] = [];
const listeners = new Set<() => void>();
const doneListeners = new Set<(job: UploadJob) => void>();
let running = 0;

function emit() {
  listeners.forEach((l) => l());
}

function update(id: string, patch: Partial<UploadJob>) {
  jobs = jobs.map((j) => (j.id === id ? { ...j, ...patch } : j));
  emit();
}

export function subscribeUploads(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export const getUploads = () => jobs;

/** Called with each upload once its row is saved — pages refresh from it. */
export function onUploaded(listener: (job: UploadJob) => void) {
  doneListeners.add(listener);
  return () => void doneListeners.delete(listener);
}

export function enqueueUploads(items: { file: File; kind: "image" | "video"; target: UploadTarget }[]) {
  const added = items.map((it) => ({
    id: crypto.randomUUID(),
    file: it.file,
    kind: it.kind,
    target: it.target,
    status: "waiting" as const,
    progress: 0,
    previewUrl: URL.createObjectURL(it.file),
    attempts: 0,
  }));
  jobs = [...jobs, ...added];
  emit();
  for (const j of added) void saveJob(j);
  pump();
}

export function retryUpload(id: string) {
  update(id, { status: "waiting", error: undefined, progress: 0, attempts: 0 });
  pump();
}

export function dismissUpload(id: string) {
  const job = jobs.find((j) => j.id === id);
  if (!job || job.status === "preparing" || job.status === "uploading") return;
  URL.revokeObjectURL(job.previewUrl);
  jobs = jobs.filter((j) => j.id !== id);
  emit();
  void forgetJob(id);
}

function pump() {
  while (running < CONCURRENCY) {
    const next = jobs.find((j) => j.status === "waiting");
    if (!next) return;
    running++;
    update(next.id, { status: "preparing", progress: 0 });
    void run(next.id).finally(() => {
      running--;
      pump();
    });
  }
}

// ffmpeg runs one video at a time; others wait their turn here.
let videoTurn: Promise<unknown> = Promise.resolve();
function oneVideoAtATime<T>(work: () => Promise<T>): Promise<T> {
  const turn = videoTurn.then(work, work);
  videoTurn = turn.catch(() => {});
  return turn;
}

/** A failure that retrying won't fix (a plan limit, a trip that's gone). */
class Final extends Error {}

async function run(id: string) {
  const job = jobs.find((j) => j.id === id);
  if (!job) return;
  const { target } = job;
  try {
    let file = job.file;
    if (job.kind === "image") {
      file = await preparePhoto(file);
    } else {
      if ((target.videoQuality ?? "standard") === "standard") {
        file = await oneVideoAtATime(async () => {
          const { compressVideo } = await import("@/lib/videoCompress");
          return compressVideo(file, (pct) => update(id, { progress: pct })).catch(() => file);
        });
      }
      file = await stripMediaMetadata(file, "video");
    }

    update(id, { status: "uploading", progress: 0 });
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("You need to be signed in to upload.");
    const path = storagePath(target.userId, target.scope, target.parentId, file);
    if (job.kind === "video") {
      const { uploadResumable } = await import("@/lib/resumableUpload");
      await uploadResumable(path, file, token, (pct) => update(id, { progress: pct }));
    } else {
      await uploadWithProgress(path, file, token, (pct) => update(id, { progress: pct }));
    }

    const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
    const { data: row, error } = await supabase
      .from(target.table)
      .insert({
        ...target.fields,
        storage_path: path,
        public_url: pub.publicUrl,
        media_type: job.kind,
        caption: target.caption ?? "",
        display_order: target.displayOrder,
      })
      .select("id")
      .single();
    if (error || !row) {
      await supabase.storage.from("media").remove([path]);
      const msg = error?.message ?? "";
      throw new Final(msg.includes("at most") ? msg : "This couldn't be saved - the trip or event may have been removed, or a limit reached.");
    }
    if (target.cover) await supabase.from(target.cover.table).update({ cover_media_id: row.id }).eq("id", target.cover.id);

    update(id, { status: "done", progress: 100 });
    void forgetJob(id);
    const done = jobs.find((j) => j.id === id);
    if (done) doneListeners.forEach((l) => l(done));
    // Stays briefly so the page can swap it for the real thing.
    setTimeout(() => {
      jobs = jobs.filter((j) => j.id !== id);
      emit();
    }, 6000);
  } catch (e) {
    const attempts = job.attempts + 1;
    const message = e instanceof Error ? e.message : "Upload failed.";
    if (!(e instanceof Final) && attempts <= RETRY_DELAYS.length) {
      // Gives its place to the next one while it waits to try again.
      update(id, { status: "retrying", attempts, progress: 0 });
      void waitForNetwork(RETRY_DELAYS[attempts - 1]).then(() => {
        if (jobs.find((j) => j.id === id)?.status !== "retrying") return;
        update(id, { status: "waiting" });
        pump();
      });
      return;
    }
    update(id, { status: "failed", attempts, error: message });
  }
}

function waitForNetwork(ms: number) {
  return new Promise<void>((resolve) => {
    const go = () => {
      window.removeEventListener("online", go);
      resolve();
    };
    if (typeof navigator !== "undefined" && !navigator.onLine) window.addEventListener("online", go);
    else setTimeout(resolve, ms);
  });
}

function uploadWithProgress(path: string, file: File, token: string, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/media/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
    xhr.send(file);
  });
}

// ---------- Kept on the device, so uploads survive the app closing ----------

const DB = "expandiax-uploads";
const STORE = "jobs";
type Saved = { id: string; file: Blob; name: string; type: string; lastModified: number; kind: "image" | "video"; target: UploadTarget };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
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

async function saveJob(j: UploadJob) {
  try {
    const saved: Saved = { id: j.id, file: j.file, name: j.file.name, type: j.file.type, lastModified: j.file.lastModified, kind: j.kind, target: j.target };
    await withStore("readwrite", (s) => s.put(saved));
  } catch {
    // Private browsing, or no room: the upload still runs, just not across restarts.
  }
}

async function forgetJob(id: string) {
  try {
    await withStore("readwrite", (s) => s.delete(id));
  } catch {
    // Nothing kept, nothing to forget.
  }
}

/** Picks up uploads that didn't finish last time — only the signed-in person's own. */
export async function resumeSavedUploads(userId: string) {
  let saved: Saved[] = [];
  try {
    saved = await withStore<Saved[]>("readonly", (s) => s.getAll() as IDBRequest<Saved[]>);
  } catch {
    return;
  }
  const mine = saved.filter((s) => s.target.userId === userId && !jobs.some((j) => j.id === s.id));
  if (!mine.length) return;
  jobs = [
    ...jobs,
    ...mine.map((s) => {
      const file = new File([s.file], s.name, { type: s.type, lastModified: s.lastModified });
      return { id: s.id, file, kind: s.kind, target: s.target, status: "waiting" as const, progress: 0, previewUrl: URL.createObjectURL(file), attempts: 0 };
    }),
  ];
  emit();
  pump();
}

/** Whether anything is still on its way up. */
export const uploadsPending = () => jobs.some((j) => j.status !== "done" && j.status !== "failed");
