// The App Store product page's own artwork (iOS 27 creative assets):
//   header.jpg          3840×1646 (21:9)  top of the product page: one idea, no phone
//   search-result.jpg   3840×2560 (3:2)   App Store search: the app, and a short headline
// JPEG, no transparency, as Apple requires. Everything that must be seen
// stays inside Apple's safe areas (header x1097–2743 y493–1154; search
// x836–3004 y765–1795). Needs appstore-screenshots/screens/phone/world.png
// from `node scripts/appstore-screenshots.mjs` first.
//
//   node scripts/appstore-creative.mjs        (HTML_ONLY=1 writes the pages instead)
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "appstore-screenshots", "creative");
const file = (p) => pathToFileURL(path.join(ROOT, p)).href;
const font = (f) => file(`node_modules/@fontsource/${f}`);
// Unsplash photos (free to use), saved next to this script (scripts/appstore-assets).
const photo = (id) => file(`scripts/appstore-assets/${id}.jpg`);

const FONTS = `
@font-face{font-family:Fraunces;font-weight:600;src:url(${font("fraunces/files/fraunces-latin-600-normal.woff2")})}
@font-face{font-family:Fraunces;font-weight:400;font-style:italic;src:url(${font("fraunces/files/fraunces-latin-400-italic.woff2")})}
@font-face{font-family:Inter;font-weight:500;src:url(${font("inter/files/inter-latin-500-normal.woff2")})}
@font-face{font-family:Inter;font-weight:600;src:url(${font("inter/files/inter-latin-600-normal.woff2")})}`;

const SKY = `background:
  radial-gradient(60% 70% at 50% 110%, rgba(250,81,162,.45) 0%, rgba(244,63,94,.18) 45%, transparent 75%),
  radial-gradient(40% 60% at 95% 10%, rgba(249,115,22,.22), transparent 70%),
  radial-gradient(40% 60% at 5% 0%, rgba(155,91,214,.25), transparent 70%),
  linear-gradient(180deg,#2a0c28 0%,#150512 100%)`;
const STARS = `<div style="position:absolute;inset:0;opacity:.55;background-image:${Array.from({ length: 70 }, (_, i) => {
  const x = (i * 37.3) % 100, y = (i * 61.7) % 100, r = i % 5 === 0 ? 3 : 2;
  return `radial-gradient(${r}px ${r}px at ${x.toFixed(1)}% ${y.toFixed(1)}%, #fff, transparent)`;
}).join(",")}"></div>`;

const card = (id, flag, name, style) => `<div class="pc" style="${style}"><img src="${photo(id)}"><div><span>${flag}</span><b>${name}</b></div></div>`;
const CSS = `${FONTS}
*{box-sizing:border-box}html,body{margin:0;overflow:hidden}
.pc{position:absolute;padding:22px 22px 0;background:#fffaf2;border-radius:18px;box-shadow:0 50px 100px rgba(0,0,0,.5),0 16px 34px rgba(0,0,0,.35)}
.pc img{display:block;width:100%;aspect-ratio:5/4;object-fit:cover;border-radius:8px}
.pc div{display:flex;align-items:center;gap:16px;padding:22px 8px 26px;font-family:Fraunces,serif;font-style:italic;color:#2b0b2e}
.pc span{font-style:normal;font-size:44px}.pc b{font-weight:400;font-size:48px}
.plane{position:absolute;font-size:64px;color:#fb7822}
h1{font-family:Fraunces,serif;font-weight:600;color:#fff;letter-spacing:-.02em;margin:0}
h1 em{font-weight:400;font-style:italic;background:linear-gradient(90deg,#ff7ab8,#ff8a5c);-webkit-background-clip:text;background-clip:text;color:transparent}
p{font-family:Inter,sans-serif;font-weight:500;color:rgba(255,255,255,.82);margin:0}`;

const PLANE = `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>`;

// ---------- Header: one idea, the world remembered; postcards at the edges ----------
const header = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
<div style="position:relative;width:3840px;height:1646px;overflow:hidden;${SKY}">${STARS}
<svg style="position:absolute;inset:0" width="3840" height="1646" viewBox="0 0 3840 1646" fill="none">
  <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#fa51a2" stop-opacity=".1"/><stop offset=".5" stop-color="#fb7822" stop-opacity=".75"/><stop offset="1" stop-color="#fa51a2" stop-opacity=".1"/></linearGradient></defs>
  <path d="M -60 1320 C 700 1000, 1200 1520, 1920 1290 S 3200 860, 3920 1060" stroke="url(#g)" stroke-width="6" stroke-dasharray="4 26" stroke-linecap="round"/>
  <path d="M 300 330 C 1100 120, 2700 120, 3560 360" stroke="rgba(255,255,255,.22)" stroke-width="5" stroke-dasharray="4 24" stroke-linecap="round"/>
</svg>
<span class="plane" style="left:2620px;top:1200px;transform:rotate(-24deg)">${PLANE}</span>
<span class="plane" style="left:1240px;top:178px;color:rgba(255,255,255,.75);font-size:52px;transform:rotate(14deg)">${PLANE}</span>
${card("photo-1499678329028-101435549a4e", "🇮🇹", "Italy", "left:70px;top:250px;width:520px;transform:rotate(-8deg)")}
${card("photo-1492571350019-22de08371fd3", "🇯🇵", "Japan", "left:520px;top:820px;width:460px;transform:rotate(6deg)")}
${card("photo-1476610182048-b716b8518aae", "🇮🇸", "Iceland", "left:-80px;top:1080px;width:440px;transform:rotate(4deg)")}
${card("photo-1531366936337-7c912a4589a7", "🇳🇴", "Norway", "right:90px;top:230px;width:520px;transform:rotate(7deg)")}
${card("photo-1564507004663-b6dfb3c824d5", "🇲🇦", "Morocco", "right:540px;top:830px;width:460px;transform:rotate(-6deg)")}
${card("photo-1548678967-f1aec58f6fb2", "🇬🇷", "Greece", "right:-70px;top:1060px;width:440px;transform:rotate(-3deg)")}
<div style="position:absolute;left:1097px;top:493px;width:1646px;height:661px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
  <img src="${file("public/wordmark.svg")}" style="height:92px;filter:brightness(0) invert(1)">
  <h1 style="margin-top:44px;font-size:168px;line-height:1">Your world, <em>remembered.</em></h1>
  <p style="margin-top:40px;font-size:50px">Every country, every trip, every night worth keeping.</p>
</div>
</div></body></html>`;

// ---------- Search result: the app itself, and the headline ----------
const world = file("appstore-screenshots/screens/phone/world.png");
const search = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}
.phone{position:absolute;padding:24px;border-radius:150px;background:linear-gradient(145deg,#3a3a40,#16161a 40%,#0c0c0f);box-shadow:0 0 0 4px #4a4a52,0 0 0 7px #0a0a0c,0 90px 180px rgba(0,0,0,.6)}
.phone img{display:block;width:100%;border-radius:128px}
.island{position:absolute;top:58px;left:50%;width:250px;height:74px;margin-left:-125px;border-radius:999px;background:#000}
.connect{position:absolute;display:flex;align-items:center;gap:30px;padding:24px 56px 24px 24px;border-radius:999px;background:rgba(24,10,22,.78);border:3px solid rgba(255,255,255,.16);box-shadow:0 40px 90px rgba(0,0,0,.45)}
.connect img{width:120px;height:120px;border-radius:999px;object-fit:cover;border:7px solid #fa51a2}
.connect img+img{margin-left:-40px;border-color:#9b5bd6}
.connect b{display:block;font-family:Inter,sans-serif;font-size:52px;font-weight:600;color:#fff}
.connect span{font-family:Inter,sans-serif;font-size:40px;font-weight:500;color:#ffc93d}
</style></head><body>
<div style="position:relative;width:3840px;height:2560px;overflow:hidden;${SKY}">${STARS}
<div style="position:absolute;left:836px;top:765px;width:1260px;height:1030px;display:flex;flex-direction:column;justify-content:center">
  <img src="${file("public/wordmark.svg")}" style="height:100px;width:auto;align-self:flex-start;filter:brightness(0) invert(1)">
  <h1 style="margin-top:56px;font-size:220px;line-height:.98">Every country.<br><em>One map.</em></h1>
  <p style="margin-top:54px;font-size:72px;line-height:1.2">Your travels and memories,<br>shared with friends.</p>
</div>
<div class="phone" style="left:2260px;top:420px;width:980px;transform:rotate(4deg)"><img src="${world}"><span class="island"></span></div>
<div class="connect" style="left:1980px;top:1610px;transform:rotate(-4deg)"><img src="${file("scripts/appstore-assets/maria.jpg")}"><img src="${file("scripts/appstore-assets/emma.jpg")}"><div><b>You &amp; Emma</b><span>23 countries in common</span></div></div>
</div></body></html>`;

if (process.env.HTML_ONLY) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, "header.html"), header);
  writeFileSync(path.join(OUT, "search-result.html"), search);
  process.exit(0);
}

// ---------- capture ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 9338;
const profile = mkdtempSync(path.join(tmpdir(), "creative-"));
const chrome = spawn(process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "about:blank"], { stdio: "ignore" });
let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  try {
    wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl;
  } catch {}
  await sleep(200);
}
if (!wsUrl) throw new Error("Chrome didn't start");
const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) pending.get(d.id)(d.result), pending.delete(d.id);
};
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await send("Page.enable");
await send("Runtime.enable");
mkdirSync(OUT, { recursive: true });
for (const [name, html, width, height] of [["header", header, 3840, 1646], ["search-result", search, 3840, 2560]]) {
  console.log("  …", name);
  const htmlFile = path.join(profile, `${name}.html`);
  writeFileSync(htmlFile, html);
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: pathToFileURL(htmlFile).href });
  // Time for the fonts and photos to arrive (polling the page here could stall Chrome).
  await sleep(9000);
  const { data } = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width, height, scale: 1 } });
  const png = path.join(OUT, `${name}.png`);
  writeFileSync(png, Buffer.from(data, "base64"));
  // JPEG: no transparency, as Apple requires.
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "90", png, "--out", path.join(OUT, `${name}.jpg`)], { stdio: "ignore" });
  rmSync(png);
  console.log("  ✓", path.relative(ROOT, path.join(OUT, `${name}.jpg`)));
}
ws.close();
chrome.kill();
