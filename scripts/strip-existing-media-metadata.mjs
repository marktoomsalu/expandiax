// One-off cleanup for photos/videos uploaded before uploads were sanitised
// (src/lib/mediaMetadata.ts): removes GPS and camera metadata from files
// already in storage.
//
//   node scripts/strip-existing-media-metadata.mjs            report only, changes nothing
//   node scripts/strip-existing-media-metadata.mjs --apply    back up every file that needs it,
//                                                              clean it, verify it, overwrite it
//
// Files keep their exact path and public URL. Backups go to
// ~/expandiax-media-backup/<date>/ (they contain the original metadata, so
// treat them as private and delete them once you're happy).

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import exifr from "exifr";
import { stripImageMetadata, stripVideoMetadata } from "../src/lib/mediaMetadata.ts";

const APPLY = process.argv.includes("--apply");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const env = Object.fromEntries(
  readFileSync(path.join(root, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")])
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MIME = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif",
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm",
};

const rows = [];
for (const table of ["country_media", "event_media"]) {
  const { data, error } = await supabase.from(table).select("id, storage_path, media_type").limit(5000);
  if (error) throw error;
  rows.push(...data.map((r) => ({ ...r, table })));
}

const stamp = new Date().toISOString().slice(0, 10);
const backupDir = path.join(homedir(), "expandiax-media-backup", stamp);
const tally = { total: 0, needsCleaning: 0, hadGps: 0, cleaned: 0, skipped: 0, failed: 0, bytes: 0 };

console.log(`${APPLY ? "APPLY" : "REPORT ONLY"} — ${rows.length} media files found\n`);

for (const row of rows) {
  tally.total++;
  const ext = row.storage_path.split(".").pop().toLowerCase();
  const type = MIME[ext];
  if (!type) { tally.skipped++; continue; }
  const { data: blob, error } = await supabase.storage.from("media").download(row.storage_path);
  if (error || !blob) { tally.failed++; console.log("  ! could not download", row.storage_path, error?.message); continue; }
  const original = new File([blob], path.basename(row.storage_path), { type });
  const before = new Uint8Array(await original.arrayBuffer());
  tally.bytes += before.length;

  const cleaned = row.media_type === "video" ? await stripVideoMetadata(original) : await stripImageMetadata(original);
  const after = new Uint8Array(await cleaned.arrayBuffer());
  const changed = after.length !== before.length || after.some((v, i) => v !== before[i]);

  let gps = null;
  if (row.media_type === "image") gps = await exifr.gps(before).catch(() => null);
  if (gps) tally.hadGps++;
  if (!changed) continue;
  tally.needsCleaning++;
  const who = row.storage_path.split("/")[0].slice(0, 8);
  console.log(`  ${row.media_type.padEnd(5)} ${ext.padEnd(4)} user ${who}  ${gps ? `GPS ${gps.latitude.toFixed(3)}, ${gps.longitude.toFixed(3)}` : "camera/device data"}`);

  if (!APPLY) continue;

  // Never overwrite anything that doesn't pass every check.
  const problems = [];
  if (after.length === 0) problems.push("empty output");
  if (row.media_type === "image") {
    if (await exifr.gps(after).catch(() => null)) problems.push("GPS still present");
    const o1 = await exifr.orientation(before).catch(() => undefined);
    const o2 = await exifr.orientation(after).catch(() => undefined);
    if ((o1 ?? 1) !== (o2 ?? 1)) problems.push(`orientation changed ${o1} -> ${o2}`);
    if (type === "image/jpeg" && !(after[0] === 0xff && after[1] === 0xd8 && after[after.length - 2] === 0xff && after[after.length - 1] === 0xd9)) problems.push("JPEG markers broken");
  } else if (after.length !== before.length) {
    problems.push("video size changed");
  }
  if (problems.length) { tally.failed++; console.log("    ✗ NOT changed:", problems.join(", ")); continue; }

  mkdirSync(path.dirname(path.join(backupDir, row.storage_path)), { recursive: true });
  writeFileSync(path.join(backupDir, row.storage_path), before);
  const { error: upErr } = await supabase.storage.from("media").upload(row.storage_path, cleaned, { upsert: true, contentType: type, cacheControl: "3600" });
  if (upErr) { tally.failed++; console.log("    ✗ upload failed:", upErr.message); continue; }
  tally.cleaned++;
}

console.log(`\nfiles checked: ${tally.total} (${(tally.bytes / 1048576).toFixed(1)} MB read)`);
console.log(`with GPS location: ${tally.hadGps}`);
console.log(`with metadata to remove: ${tally.needsCleaning}`);
if (APPLY) console.log(`cleaned and overwritten: ${tally.cleaned}   failed/kept: ${tally.failed}\nbackups: ${backupDir}`);
else console.log("\n(report only — nothing was changed. Re-run with --apply to clean them.)");
