// Builds the App Store screenshot set (6.9" iPhone, 1290×2796).
//
//   1. npm run dev -- -p 3010        (in another terminal)
//   2. node scripts/appstore-screenshots.mjs
//
// Pass 1 captures each phone screen from /appstore-screens/<slug> at real
// iPhone size (393×852 pt at 3×) using the app's own components. Pass 2
// puts each capture into an iPhone frame on a branded slide with its
// headline. Output: appstore-screenshots/ (not committed).

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BASE = process.env.APPSTORE_BASE_URL ?? "http://localhost:3010";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "appstore-screenshots");
const SCREENS_DIR = path.join(OUT, "screens");
const PORT = 9337;

const SLIDE = { width: 1290, height: 2796 };
const PHONE = { width: 1000, bezel: 26, top: 700 };

const SLIDES = [
  {
    file: "01-your-world",
    screen: "feed",
    bg: "brand",
    logo: true,
    headline: "Your world,<br><em>remembered.</em>",
    sub: "Every trip, concert and night out,<br>kept in one beautiful place.",
    tilt: 0,
  },
  {
    file: "02-one-map",
    screen: "world",
    bg: "dark",
    headline: "Every country.<br><em>One map.</em>",
    sub: "Watch your world light up as you go.",
    tilt: -3,
    float: `<div class="float photo-card" style="left:40px;top:1880px;transform:rotate(-6deg)">
      <img src="https://picsum.photos/id/1015/600/420"><div><b>🇳🇴 Norway</b><span>May 2025 · 3 photos</span></div></div>`,
  },
  {
    file: "03-never-forget",
    screen: "event",
    bg: "dark",
    headline: "The nights you&rsquo;ll<br><em>never forget.</em>",
    sub: "Concerts, festivals and matches,<br>with the photos and the song.",
    tilt: 3,
    float: `<div class="float sticker" style="right:36px;top:1990px">
      <img src="https://picsum.photos/id/195/200/200"><div><b>Summer Static</b><span>The Northern Lights</span></div>
      <i class="eq"><s></s><s></s><s></s></i></div>`,
  },
  {
    file: "04-find-you-again",
    screen: "then",
    bg: "dark",
    headline: "Memories that<br><em>find you again.</em>",
    sub: "Anniversaries and favourites,<br>brought back when they matter.",
    tilt: -3,
  },
  {
    file: "05-in-seconds",
    screen: "create",
    bg: "dark",
    headline: "Add a memory<br><em>in seconds.</em>",
    sub: "A few photos and a date. Done.<br>Everything else can wait.",
    tilt: 0,
    float: `<div class="float toast" style="right:48px;top:1540px"><i>✓</i><div><b>Added to your world</b><span>🇪🇪 Estonia · 3 photos</span></div></div>`,
  },
];

// ---------- tiny Chrome DevTools Protocol client ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const profile = path.join(tmpdir(), `appstore-shots-${Date.now()}`);
  const proc = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      "--hide-scrollbars",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  for (let i = 0; i < 50; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = targets.find((t) => t.type === "page");
      if (page) return { proc, profile, wsUrl: page.webSocketDebuggerUrl };
    } catch {}
    await sleep(200);
  }
  proc.kill();
  throw new Error("Chrome didn't start");
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const waiters = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const { resolve, reject } = pending.get(d.id);
      pending.delete(d.id);
      d.error ? reject(new Error(d.error.message)) : resolve(d.result);
    } else if (d.method) {
      for (const w of [...waiters]) if (w.method === d.method) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(d.params);
      }
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const once = (method) => new Promise((resolve) => waiters.push({ method, resolve }));
  return new Promise((resolve) => (ws.onopen = () => resolve({ send, once, close: () => ws.close() })));
}

async function capture(cdp, { url, width, height, scale, file, settleMs }) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: scale > 1 });
  const loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url });
  await loaded;
  // Fonts + every image decoded, then extra time for animations / the globe.
  for (let i = 0; i < 60; i++) {
    const { result } = await cdp.send("Runtime.evaluate", {
      expression: "document.fonts.ready.then(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))",
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.value) break;
    await sleep(250);
  }
  await sleep(settleMs);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width, height, scale: 1 } });
  writeFileSync(file, Buffer.from(data, "base64"));
  console.log("  ✓", path.relative(ROOT, file));
}

// ---------- slide template ----------

const font = (file) => pathToFileURL(path.join(ROOT, "node_modules/@fontsource", file)).href;

function slideHtml(s) {
  const screenUrl = pathToFileURL(path.join(SCREENS_DIR, `${s.screen}.png`)).href;
  const wordmark = pathToFileURL(path.join(ROOT, "public/wordmark.svg")).href;
  const inner = PHONE.width - PHONE.bezel * 2;
  const pt = inner / 393; // screen pixels per iPhone point
  const radius = Math.round(55 * pt);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Fraunces;font-weight:600;src:url(${font("fraunces/files/fraunces-latin-600-normal.woff2")})}
@font-face{font-family:Fraunces;font-weight:400;font-style:italic;src:url(${font("fraunces/files/fraunces-latin-400-italic.woff2")})}
@font-face{font-family:Inter;font-weight:500;src:url(${font("inter/files/inter-latin-500-normal.woff2")})}
@font-face{font-family:Inter;font-weight:600;src:url(${font("inter/files/inter-latin-600-normal.woff2")})}
*{box-sizing:border-box}
html,body{margin:0;width:${SLIDE.width}px;height:${SLIDE.height}px;overflow:hidden}
.slide{position:relative;width:100%;height:100%;overflow:hidden;font-family:Inter,sans-serif;color:#fff}
.bg-brand{background:
  radial-gradient(70% 40% at 15% 8%, rgba(255,255,255,.22), transparent 70%),
  linear-gradient(160deg,#FA51A2 0%,#F43F5E 52%,#F97316 100%)}
.bg-dark{background:
  radial-gradient(95% 50% at 50% 104%, rgba(250,81,162,.62) 0%, rgba(244,63,94,.28) 42%, transparent 72%),
  radial-gradient(60% 34% at 92% 30%, rgba(249,115,22,.20), transparent 70%),
  radial-gradient(55% 30% at 6% 12%, rgba(250,81,162,.16), transparent 70%),
  linear-gradient(180deg,#230b20 0%,#150512 100%)}
.logo{position:absolute;top:118px;left:0;right:0;display:flex;justify-content:center}
.logo img{height:58px;filter:brightness(0) invert(1)}
.headline{position:absolute;left:60px;right:60px;top:${s.logo ? 230 : 190}px;text-align:center;font-family:Fraunces,serif;font-weight:600;font-size:128px;line-height:1.02;letter-spacing:-.02em}
.headline em{font-weight:400;font-style:italic;letter-spacing:-.01em}
.bg-dark .headline em{background:linear-gradient(90deg,#ff7ab8 0%,#ff8a5c 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{position:absolute;left:80px;right:80px;top:${s.logo ? 530 : 490}px;text-align:center;font-weight:500;font-size:44px;line-height:1.32;color:rgba(255,255,255,.82)}
.phone{position:absolute;top:${PHONE.top + (s.logo ? 40 : 0)}px;left:50%;width:${PHONE.width}px;margin-left:-${PHONE.width / 2}px;padding:${PHONE.bezel}px;
  border-radius:${radius + PHONE.bezel}px;background:linear-gradient(145deg,#3a3a40,#16161a 40%,#0c0c0f);
  box-shadow:0 0 0 3px #4a4a52,0 0 0 5px #0a0a0c,0 80px 160px rgba(0,0,0,.55),0 30px 60px rgba(0,0,0,.35);
  transform:rotate(${s.tilt}deg);transform-origin:50% 30%}
.phone img.screen{display:block;width:100%;border-radius:${radius}px}
.island{position:absolute;top:${PHONE.bezel + Math.round(11 * pt)}px;left:50%;width:${Math.round(126 * pt)}px;height:${Math.round(37 * pt)}px;margin-left:-${Math.round(63 * pt)}px;border-radius:999px;background:#000}
.btn{position:absolute;width:10px;border-radius:4px;background:#2a2a30}
.float{position:absolute;z-index:5;box-shadow:0 40px 90px rgba(0,0,0,.45),0 12px 30px rgba(0,0,0,.3)}
.photo-card{width:420px;border-radius:40px;overflow:hidden;background:#fff;color:#17171b}
.photo-card img{display:block;width:100%;height:300px;object-fit:cover}
.photo-card div{padding:26px 30px 30px;display:flex;flex-direction:column;gap:6px}
.photo-card b{font-family:Fraunces,serif;font-weight:600;font-size:40px}
.photo-card span{font-size:26px;color:#6b6b75}
.sticker{display:flex;align-items:center;gap:22px;padding:16px 34px 16px 16px;border-radius:36px;background:rgba(24,10,22,.72);backdrop-filter:blur(18px);border:2px solid rgba(255,255,255,.16)}
.sticker img{width:96px;height:96px;border-radius:20px;object-fit:cover}
.sticker div{display:flex;flex-direction:column;gap:4px}
.sticker b{font-size:36px;font-weight:600}
.sticker span{font-size:28px;color:rgba(255,255,255,.65)}
.toast{display:flex;align-items:center;gap:24px;padding:26px 40px 26px 26px;border-radius:40px;background:#fff;color:#17171b}
.toast i{display:flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:999px;background:linear-gradient(135deg,#FA51A2,#F97316);color:#fff;font-style:normal;font-size:40px;font-weight:600}
.toast div{display:flex;flex-direction:column;gap:4px}
.toast b{font-size:36px;font-weight:600}
.toast span{font-size:28px;color:#6b6b75}
.eq{display:flex;align-items:flex-end;gap:6px;height:40px;margin-left:10px}
.eq s{display:block;width:8px;border-radius:4px;background:#fff}
.eq s:nth-child(1){height:55%}.eq s:nth-child(2){height:100%}.eq s:nth-child(3){height:70%}
</style></head><body>
<div class="slide bg-${s.bg}">
  ${s.logo ? `<div class="logo"><img src="${wordmark}"></div>` : ""}
  <div class="headline">${s.headline}</div>
  <div class="sub">${s.sub}</div>
  <div class="phone">
    <span class="btn" style="left:-8px;top:360px;height:130px"></span>
    <span class="btn" style="left:-8px;top:540px;height:130px"></span>
    <span class="btn" style="right:-8px;top:460px;height:200px"></span>
    <img class="screen" src="${screenUrl}">
    <span class="island"></span>
  </div>
  ${s.float ?? ""}
</div></body></html>`;
}

// ---------- run ----------

rmSync(OUT, { recursive: true, force: true });
mkdirSync(SCREENS_DIR, { recursive: true });
const html = path.join(tmpdir(), "appstore-slides");
mkdirSync(html, { recursive: true });

const chrome = await launch();
try {
  const cdp = await connect(chrome.wsUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });

  console.log("Phone screens:");
  for (const slug of [...new Set(SLIDES.map((s) => s.screen))]) {
    await capture(cdp, {
      url: `${BASE}/appstore-screens/${slug}`,
      width: 393,
      height: 852,
      scale: 3,
      file: path.join(SCREENS_DIR, `${slug}.png`),
      settleMs: slug === "world" ? 9000 : 2500,
    });
  }

  console.log("Slides:");
  for (const s of SLIDES) {
    const file = path.join(html, `${s.file}.html`);
    writeFileSync(file, slideHtml(s));
    await capture(cdp, {
      url: pathToFileURL(file).href,
      width: SLIDE.width,
      height: SLIDE.height,
      scale: 1,
      file: path.join(OUT, `${s.file}.png`),
      settleMs: 500,
    });
  }
  cdp.close();
} finally {
  const exited = new Promise((r) => chrome.proc.once("exit", r));
  chrome.proc.kill();
  await exited;
  rmSync(chrome.profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
console.log(`\nDone → ${path.relative(ROOT, OUT)}/`);
