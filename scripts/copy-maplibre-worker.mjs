// The map library runs its tile work in a web worker, loaded from a file
// next to the library itself. Once bundled, "next to" no longer exists, so
// the worker (and the shared code it imports) is served from /public
// instead, under the installed version so a new version is never mixed
// with an old cached one.
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";

const { version } = JSON.parse(readFileSync("node_modules/maplibre-gl/package.json", "utf8"));
const out = `public/maplibre/${version}`;
rmSync("public/maplibre", { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(`node_modules/maplibre-gl/dist/${f}`, `${out}/${f}`);
