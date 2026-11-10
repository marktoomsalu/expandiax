"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clock, Smartphone, UserPlus, X } from "lucide-react";
import { App } from "@capacitor/app";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { createClient } from "@/lib/supabase/client";
import { countryByCode } from "@/lib/countries";
import { hasRealName } from "@/lib/profileName";
import { isNativePlatform } from "@/lib/capacitor";
import {
  clearTouch,
  closeness,
  getServerState,
  getState,
  hasGlobeTouch,
  startTouch,
  stopTouch,
  subscribe,
  type TouchState,
} from "@/lib/globeTouch";
import { compareGlobes, type GlobeCountry } from "@/lib/globeTouchLogic";
import { setTouchAsked, setTouchReady, isTouchReady } from "@/lib/globeTouchReady";

const TouchGlobe = dynamic(() => import("./TouchGlobeInner").then((m) => m.TouchGlobeInner), { ssr: false });

export type TouchMe = { id: string; username: string; display_name: string; avatar_url: string | null };
type Peer = TouchMe & { home_country_code: string | null; visibility: string };
type Result = {
  peer: Peer;
  peer_countries: GlobeCountry[];
  my_countries: GlobeCountry[];
  i_follow: boolean;
  they_follow: boolean;
  i_requested: boolean;
  they_requested: boolean;
};

// The colours of two globes together.
const MINE = "#fb7822";
const THEIRS = "#2dd4bf";
const BOTH = "#fde047";
const LIVED = "#fa51a2";

const firstName = (p: TouchMe) => (hasRealName(p.display_name) ? p.display_name.trim().split(/\s+/)[0] : `@${p.username}`);

function buzz(style: ImpactStyle) {
  if (isNativePlatform()) Haptics.impact({ style }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Where the touch state comes from: the phone, or a made-up one for ?demo.

const DEMO_PEER: Peer = { id: "demo-peer", username: "alex", display_name: "Alex", avatar_url: null, home_country_code: "PT", visibility: "public" };
const DEMO_PEER_COUNTRIES = ["IT", "ES", "FR", "PT", "GR", "HR", "XK", "AL", "JP", "TH", "US", "MX", "MA", "TR", "DE", "BR", "PE", "VN"].map((code) => ({ code, lived: code === "PT" }));
const DEMO_CODE = "0".repeat(32);

function useDemoState(demo: "approach" | "reveal" | null, fixedCm: number | null, run: number): TouchState {
  const [s, setS] = useState<TouchState>(() => ({ ...getServerState(), status: "searching", preciseDistance: true, myCode: DEMO_CODE }));
  useEffect(() => {
    if (!demo) return;
    const touch = { peerId: "demo", myCode: DEMO_CODE, peerCode: "f".repeat(32), at: Date.now() };
    const peer = (meters: number | null) => ({ demo: { id: "demo", code: touch.peerCode, meters, direction: null, readings: [], bumpAt: 0 } });
    if (demo === "reveal") {
      setS((x) => ({ ...x, peers: peer(0.05), touch }));
      return;
    }
    setS((x) => ({ ...x, peers: {}, touch: null }));
    if (fixedCm != null) {
      setS((x) => ({ ...x, peers: peer(fixedCm / 100) }));
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      const t = (Date.now() - start) / 1000;
      if (t < 1.6) return;
      const meters = Math.max(0.05, 1.3 - (t - 1.6) * 0.24);
      setS((x) => (x.touch ? x : { ...x, peers: peer(meters), touch: meters <= 0.06 ? { ...touch, at: Date.now() } : null }));
    }, 50);
    return () => clearInterval(id);
  }, [demo, fixedCm, run]);
  return s;
}

// ---------------------------------------------------------------------------

export function TouchGlobes({
  me,
  myCountries,
  demo,
  fixedCm,
}: {
  me: TouchMe;
  myCountries: GlobeCountry[];
  demo: "approach" | "reveal" | null;
  fixedCm: number | null;
}) {
  const router = useRouter();
  const live = useSyncExternalStore(subscribe, getState, getServerState);
  const [demoRun, setDemoRun] = useState(0);
  const demoState = useDemoState(demo, fixedCm, demoRun);
  const s = demo ? demoState : live;

  const [mounted, setMounted] = useState(false);
  const [started, setStarted] = useState(false);
  const [size, setSize] = useState(300);
  const [result, setResult] = useState<Result | null>(null);
  const [failed, setFailed] = useState(false);

  // Size the globe to the phone, and decide where to begin.
  useEffect(() => {
    setMounted(true);
    const fit = () => setSize(Math.round(Math.min(window.innerWidth * 0.8, window.innerHeight * 0.42, 380)));
    fit();
    window.addEventListener("resize", fit);
    if (demo) setStarted(true);
    else if (hasGlobeTouch() && (getState().touch || isTouchReady())) {
      setStarted(true);
      // A touch that happened on another screen is picked up as it is.
      if (!getState().touch) void startTouch("screen");
    }
    return () => window.removeEventListener("resize", fit);
  }, [demo]);

  // Leaving: keep listening quietly, so a touch from anywhere in the app still works.
  useEffect(() => {
    if (demo) return;
    // The radio stops while the app is in the background; pick up again on return.
    const sub = App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) void stopTouch();
      else if (isTouchReady() && !getState().touch) void startTouch("screen");
    });
    return () => {
      void sub.then((l) => l.remove());
      clearTouch();
      if (isTouchReady()) void startTouch("background");
      else void stopTouch();
    };
  }, [demo]);

  function begin() {
    setTouchReady();
    setTouchAsked();
    setStarted(true);
    void startTouch("screen");
  }

  function again() {
    setResult(null);
    setFailed(false);
    if (demo) {
      setDemoRun((n) => n + 1);
      return;
    }
    clearTouch();
    void startTouch("screen");
  }

  // The touch: ask the server until the other phone has reported it too.
  const touch = s.touch;
  useEffect(() => {
    if (!touch) return;
    let alive = true;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    setResult(null);
    setFailed(false);
    buzz(ImpactStyle.Heavy);
    const ask = async () => {
      if (!alive) return;
      const r = demo
        ? ({ peer: DEMO_PEER, peer_countries: DEMO_PEER_COUNTRIES, my_countries: myCountries, i_follow: false, they_follow: false, i_requested: false, they_requested: false } as Result)
        : await createClient()
            .rpc("globe_touch", { p_code: touch.myCode, p_peer_code: touch.peerCode })
            .then(({ data }) => (data as Result | null) ?? null, () => null);
      if (!alive) return;
      if (r) {
        setResult(r);
        if (isNativePlatform()) Haptics.notification({ type: NotificationType.Success }).catch(() => {});
        return;
      }
      if (++tries >= 16) setFailed(true);
      else timer = setTimeout(ask, 700);
    };
    timer = setTimeout(ask, 1100);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [touch?.myCode, touch?.peerCode, demo]); // eslint-disable-line react-hooks/exhaustive-deps

  // While the result is up, keep the follow buttons current (the other phone taps too).
  useEffect(() => {
    if (!result || demo || !touch) return;
    const id = setInterval(async () => {
      const { data } = await createClient().rpc("globe_touch", { p_code: touch.myCode, p_peer_code: touch.peerCode });
      if (data) setResult(data as Result);
    }, 2500);
    return () => clearInterval(id);
  }, [!!result, demo, touch?.myCode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function follow() {
    if (!touch || !result) return;
    buzz(ImpactStyle.Medium);
    if (demo) {
      setResult({ ...result, i_follow: true });
      setTimeout(() => setResult((r) => (r ? { ...r, they_follow: true } : r)), 1400);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.rpc("globe_touch_follow", { p_code: touch.myCode });
    if (error) return;
    const { data } = await supabase.rpc("globe_touch", { p_code: touch.myCode, p_peer_code: touch.peerCode });
    if (data) setResult(data as Result);
  }

  const close = () => router.push("/my-world");

  let body: React.ReactNode;
  if (!mounted) body = null;
  else if (!demo && !hasGlobeTouch()) body = <Unsupported />;
  else if (!started) body = <Intro me={me} myCountries={myCountries} size={size} onStart={begin} />;
  else if (result) body = <Reveal me={me} result={result} size={size} onFollow={follow} onAgain={again} />;
  else if (failed) body = <Failed onAgain={again} />;
  else body = <Searching state={s} myCountries={myCountries} size={size} touching={!!touch} />;

  return (
    <div className="touch-stage fixed inset-0 z-[70] overflow-y-auto overflow-x-hidden text-white">
      <Stars />
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="fixed right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur hover:bg-white/20"
        style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <X size={18} />
      </button>
      <div className="relative z-10 mx-auto flex min-h-full max-w-md flex-col px-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 18px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
        {body}
      </div>
      <style>{STYLES}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screens

function Intro({ me, myCountries, size, onStart }: { me: TouchMe; myCountries: GlobeCountry[]; size: number; onStart: () => void }) {
  const colors = useMemo(() => colorsOf(myCountries), [myCountries]);
  return (
    <div className="flex flex-1 flex-col items-center text-center">
      <p className="touch-eyebrow mt-2">New</p>
      <h1 className="mt-2 font-serif text-4xl leading-tight">Touch globes</h1>
      <div className="relative my-6" style={{ width: size, height: size }}>
        <Rings speed={2.6} strength={0.35} />
        <TouchGlobe size={size} colors={colors} spin={0.7} />
      </div>
      <p className="max-w-xs text-base text-white/80">
        Hold your iPhone against a friend&rsquo;s. You&rsquo;ll both see your globes side by side, the countries you share, and can follow each other right there.
      </p>
      <ul className="mt-5 space-y-2 text-left text-sm text-white/60">
        <li className="flex gap-2"><Smartphone size={16} className="mt-0.5 shrink-0" /> Your friend opens ExpandiaX too.</li>
        <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0" /> Only what you both see on your globes is shared, and only when you touch.</li>
      </ul>
      <button type="button" onClick={onStart} className="touch-cta mt-auto w-full">
        Start
      </button>
      <p className="mt-3 text-xs text-white/45">Your iPhone will ask to find devices nearby. That&rsquo;s how it feels your friend&rsquo;s phone.</p>
      <span className="sr-only">{me.display_name}</span>
    </div>
  );
}

function Searching({ state, myCountries, size, touching }: { state: TouchState; myCountries: GlobeCountry[]; size: number; touching: boolean }) {
  const colors = useMemo(() => colorsOf(myCountries), [myCountries]);
  const { peer, value: c } = closeness(state);
  const meters = peer?.meters ?? null;
  const linked = !!peer;

  // Ticks that quicken as the phones come together, like a heartbeat.
  const cRef = useRef(c);
  cRef.current = c;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const v = cRef.current;
      if (v > 0.03) buzz(v > 0.75 ? ImpactStyle.Medium : ImpactStyle.Light);
      timer = setTimeout(tick, 700 - 600 * v);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  const orb = 52 + 74 * c;
  const dx = (peer?.direction?.x ?? 0) * 70 * (1 - c);
  // Comes down from the top of the screen until it meets the top of your globe.
  const far = -orb - 40;
  const met = size * 0.1 - orb * 0.55;
  const orbTop = linked ? (meters == null ? -orb * 0.5 : far + (met - far) * c) : -orb * 1.5;

  let title = "Hold your iPhone near a friend’s";
  let sub = "They open ExpandiaX too. Then bring the tops of your phones together.";
  if (linked && meters == null && !state.preciseDistance) {
    title = "A friend is nearby";
    sub = "Tap your phones together, gently.";
  } else if (linked && meters == null) {
    title = "A friend is nearby";
    sub = "Bring your phones together.";
  } else if (linked) {
    title = c > 0.85 ? "Almost…" : "Closer";
    sub = "";
  }

  return (
    <div className="flex flex-1 flex-col items-center text-center">
      <p className="touch-eyebrow mt-2">Touch globes</p>
      <div className="relative mt-10" style={{ width: size, height: size }}>
        <div
          className="touch-orb absolute left-1/2 z-10 rounded-full"
          style={{
            width: orb,
            height: orb,
            top: orbTop,
            transform: `translateX(calc(-50% + ${dx}px))`,
            opacity: linked ? 0.35 + 0.65 * Math.max(c, 0.3) : 0,
            boxShadow: `0 0 ${30 + 70 * c}px ${10 + 30 * c}px rgba(250,81,162,${0.25 + 0.5 * c})`,
          }}
          aria-hidden
        />
        <Rings speed={2.6 - 2 * c} strength={0.3 + 0.7 * c} />
        <div style={{ filter: `drop-shadow(0 0 ${12 + 50 * c}px rgba(251,120,34,${0.25 + 0.6 * c}))` }}>
          <TouchGlobe size={size} colors={colors} spin={0.7 + 9 * c} glow={c > 0.5 ? "#fde047" : "#fa51a2"} />
        </div>
        {touching && <div className="touch-flash pointer-events-none fixed inset-0 z-30" aria-hidden />}
      </div>

      <div className="mt-8 min-h-[7.5rem]" aria-live="polite">
        {touching ? (
          <p className="touch-pop font-serif text-3xl">Touching globes&hellip;</p>
        ) : (
          <>
            {linked && meters != null && <p className="font-serif text-6xl tabular-nums">{formatDistance(meters)}</p>}
            <p className={linked && meters != null ? "mt-2 text-lg text-white/80" : "font-serif text-2xl"}>{title}</p>
            {sub && <p className="mx-auto mt-2 max-w-xs text-sm text-white/60">{sub}</p>}
          </>
        )}
      </div>

      {state.problem === "network" && (
        <Notice>
          ExpandiaX can&rsquo;t look for phones nearby. Turn on <b>Local Network</b> in Settings &rsaquo; ExpandiaX.
        </Notice>
      )}
      {state.problem === "distance" && (
        <Notice>
          Without <b>Nearby Interactions</b> (Settings &rsaquo; ExpandiaX), tap your phones together instead.
        </Notice>
      )}
    </div>
  );
}

function Reveal({ me, result, size, onFollow, onAgain }: { me: TouchMe; result: Result; size: number; onFollow: () => void; onAgain: () => void }) {
  const { peer } = result;
  const name = firstName(peer);
  const g = useMemo(() => compareGlobes(result.my_countries, result.peer_countries), [result.my_countries, result.peer_countries]);
  const colors = useMemo(() => {
    const m: Record<string, string> = {};
    g.onlyMine.forEach((c) => (m[c] = MINE));
    g.onlyTheirs.forEach((c) => (m[c] = THEIRS));
    g.both.forEach((c) => (m[c] = BOTH));
    return m;
  }, [g]);
  const count = useCountUp(g.both.length, 1400, 900);
  const theirExtra = g.onlyTheirs.slice(0, 14);

  return (
    <div className="flex flex-col items-center pb-6 text-center">
      <div className="mt-6 flex items-center justify-center">
        <div className="touch-from-left"><Face person={me} size={84} ring={MINE} /></div>
        <div className="touch-spark mx-[-10px] z-10 h-6 w-6 rounded-full" aria-hidden />
        <div className="touch-from-right"><Face person={peer} size={84} ring={THEIRS} /></div>
      </div>
      <p className="touch-rise mt-4 font-serif text-2xl" style={{ animationDelay: "500ms" }}>
        You &amp; {name}
      </p>

      <div className="touch-rise mt-6" style={{ animationDelay: "800ms" }}>
        {g.both.length > 0 ? (
          <>
            <p className="touch-gold font-serif text-8xl leading-none tabular-nums">{count}</p>
            <p className="mt-2 text-lg text-white/85">{g.both.length === 1 ? "country you’ve both been to" : "countries you’ve both been to"}</p>
          </>
        ) : (
          <>
            <p className="font-serif text-4xl">No country in common yet</p>
            <p className="mt-2 text-white/70">Sounds like your next trip together.</p>
          </>
        )}
      </div>

      <div className="touch-rise relative mt-4" style={{ width: size, height: size, animationDelay: "1100ms" }}>
        <TouchGlobe size={size} colors={colors} spin={1.1} glow="#fde047" />
      </div>
      <div className="touch-rise flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-white/75" style={{ animationDelay: "1300ms" }}>
        <Key color={BOTH} label={`Both (${g.both.length})`} />
        <Key color={MINE} label={`Only you (${g.onlyMine.length})`} />
        <Key color={THEIRS} label={`Only ${name} (${g.onlyTheirs.length})`} />
      </div>

      {g.both.length > 0 && (
        <ul className="mt-6 flex flex-wrap justify-center gap-2">
          {g.both.map((code, i) => (
            <li key={code} className="touch-chip" style={{ animationDelay: `${1500 + i * 70}ms` }}>
              {countryByCode(code)?.flag} {countryByCode(code)?.name}
            </li>
          ))}
        </ul>
      )}

      <p className="touch-rise mt-8 font-serif text-2xl" style={{ animationDelay: "1800ms" }}>
        Together you&rsquo;ve seen {g.together} {g.together === 1 ? "country" : "countries"}.
      </p>
      {theirExtra.length > 0 && (
        <div className="touch-rise mt-3" style={{ animationDelay: "1950ms" }}>
          <p className="text-sm text-white/65">{name} has been where you haven&rsquo;t:</p>
          <p className="mt-2 text-2xl leading-relaxed" aria-label={g.onlyTheirs.map((c) => countryByCode(c)?.name).join(", ")}>
            {theirExtra.map((c) => countryByCode(c)?.flag).join(" ")}
            {g.onlyTheirs.length > theirExtra.length && <span className="ml-1 align-middle text-sm text-white/60">+{g.onlyTheirs.length - theirExtra.length}</span>}
          </p>
        </div>
      )}

      <FollowCard result={result} name={name} onFollow={onFollow} />

      <div className="touch-rise mt-6 flex w-full flex-col gap-3" style={{ animationDelay: "2300ms" }}>
        {peer.id !== DEMO_PEER.id && (
          <Link href={`/u/${peer.username}`} className="touch-ghost">
            See {name}&rsquo;s world
          </Link>
        )}
        <button type="button" onClick={onAgain} className="touch-ghost">
          Touch another friend
        </button>
      </div>
    </div>
  );
}

function FollowCard({ result, name, onFollow }: { result: Result; name: string; onFollow: () => void }) {
  const { peer, i_follow, i_requested, they_follow, they_requested } = result;
  const [busy, setBusy] = useState(false);
  const both = i_follow && they_follow;

  let status: React.ReactNode;
  if (both) status = <><Check size={15} className="inline" /> You follow each other.</>;
  else if (they_follow) status = <>{name} follows you.</>;
  else if (they_requested) status = <>{name} wants to follow you. Following back lets them in.</>;
  else status = <>{name} can follow you from their phone.</>;

  const label = i_follow ? "Following" : i_requested ? "Requested" : they_follow || they_requested ? "Follow back" : `Follow ${name}`;

  return (
    <div className={`touch-rise mt-8 w-full rounded-3xl border p-4 text-left ${both ? "touch-glow border-yellow-200/50" : "border-white/15"} bg-white/[0.06] backdrop-blur`} style={{ animationDelay: "2100ms" }}>
      <div className="flex items-center gap-3">
        <Face person={peer} size={48} ring={THEIRS} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{hasRealName(peer.display_name) ? peer.display_name : name}</p>
          <p className="truncate text-sm text-white/55">@{peer.username}</p>
        </div>
        <button
          type="button"
          disabled={busy || i_follow || i_requested}
          onClick={async () => {
            setBusy(true);
            await onFollow();
            setBusy(false);
          }}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
            i_follow ? "bg-white/15 text-white" : i_requested ? "bg-white/10 text-white/70" : "touch-follow text-[#2b0b2e]"
          }`}
        >
          {i_follow ? <Check size={15} /> : i_requested ? <Clock size={15} /> : <UserPlus size={15} />}
          {label}
        </button>
      </div>
      <p className="mt-3 text-sm text-white/70" aria-live="polite">{status}</p>
    </div>
  );
}

function Failed({ onAgain }: { onAgain: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="font-serif text-3xl">That didn&rsquo;t connect</p>
      <p className="mt-3 max-w-xs text-white/70">Keep both phones on this screen, with internet, and touch them together again.</p>
      <button type="button" onClick={onAgain} className="touch-cta mt-8 w-full">Try again</button>
    </div>
  );
}

function Unsupported() {
  const android = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="touch-eyebrow">Touch globes</p>
      <p className="mt-3 font-serif text-3xl">{android ? "Coming to Android" : "Made for iPhone"}</p>
      <p className="mt-3 max-w-xs text-white/70">
        {android
          ? "Touching globes works between iPhones for now. Android is on its way."
          : "Hold two iPhones together in the ExpandiaX app to see the countries you share. Update the app if you don’t see it yet."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces

function Face({ person, size, ring }: { person: TouchMe; size: number; ring: string }) {
  return (
    <span
      className="flex items-center justify-center overflow-hidden rounded-full bg-white/10 font-serif text-white"
      style={{ width: size, height: size, boxShadow: `0 0 0 3px ${ring}, 0 0 28px ${ring}66`, fontSize: size * 0.4 }}
    >
      {person.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        firstName(person).replace("@", "").charAt(0).toUpperCase()
      )}
    </span>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      {label}
    </span>
  );
}

function Rings({ speed, strength }: { speed: number; strength: number }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="touch-ring absolute inset-0 rounded-full"
          style={{ animationDuration: `${Math.max(0.5, speed)}s`, animationDelay: `${(i * Math.max(0.5, speed)) / 3}s`, opacity: strength }}
        />
      ))}
    </div>
  );
}

function Stars() {
  const stars = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => {
        const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
        return { left: r(1) * 100, top: r(2) * 100, size: 1 + r(3) * 1.8, delay: r(4) * 4 };
      }),
    []
  );
  return (
    <div className="pointer-events-none fixed inset-0" aria-hidden>
      {stars.map((s, i) => (
        <span key={i} className="touch-star absolute rounded-full bg-white" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }} />
      ))}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/80">{children}</p>;
}

function colorsOf(countries: GlobeCountry[]) {
  const m: Record<string, string> = {};
  for (const c of countries) m[c.code] = c.lived ? LIVED : MINE;
  return m;
}

function formatDistance(meters: number) {
  if (meters >= 1) return `${meters.toFixed(1)} m`;
  return `${Math.max(1, Math.round(meters * 100))} cm`;
}

function useCountUp(target: number, duration: number, delay: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + delay;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      setN(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);
  return n;
}

const STYLES = `
.touch-stage { background: radial-gradient(120% 70% at 50% 0%, #2b0b2e 0%, #1a0620 45%, #07020a 100%); overscroll-behavior: contain; }
.touch-eyebrow { font-size: .72rem; letter-spacing: .22em; text-transform: uppercase; color: rgba(255,255,255,.55); font-weight: 600; }
.touch-cta { border-radius: 9999px; padding: 1rem 1.5rem; font-weight: 700; font-size: 1.05rem; color: #2b0b2e; background: linear-gradient(90deg, #fa51a2, #fb7822); box-shadow: 0 10px 40px rgba(250,81,162,.35); }
.touch-ghost { display: block; border-radius: 9999px; padding: .85rem 1.25rem; font-weight: 600; border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.06); }
.touch-follow { background: linear-gradient(90deg, #fde047, #fb7822); box-shadow: 0 6px 24px rgba(253,224,71,.35); }
.touch-gold { background: linear-gradient(180deg, #fff7c2, #fde047 45%, #fb7822); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 6px 30px rgba(253,224,71,.35)); }
.touch-orb { background: radial-gradient(circle at 35% 30%, #fff 0%, #ffd0e6 18%, #fa51a2 45%, #7c1d6f 80%); transition: top .18s linear, width .18s linear, height .18s linear, opacity .4s; }
.touch-ring { border: 2px solid rgba(250,81,162,.7); animation: touch-ring 2.4s ease-out infinite; }
@keyframes touch-ring { from { transform: scale(.92); opacity: .9; } to { transform: scale(1.55); opacity: 0; } }
.touch-star { opacity: .25; animation: touch-twinkle 4s ease-in-out infinite; }
@keyframes touch-twinkle { 50% { opacity: .85; } }
.touch-flash { background: radial-gradient(circle at 50% 45%, #fff 0%, #fde047 20%, rgba(250,81,162,.85) 45%, rgba(43,11,46,0) 75%); animation: touch-flash 1.2s ease-out forwards; }
@keyframes touch-flash { 0% { opacity: 0; transform: scale(.2); } 18% { opacity: 1; } 100% { opacity: 0; transform: scale(2.2); } }
.touch-pop { animation: touch-pop .6s cubic-bezier(.2,1.4,.4,1) both; }
@keyframes touch-pop { from { transform: scale(.6); opacity: 0; } }
.touch-rise { animation: touch-rise .8s cubic-bezier(.2,.8,.2,1) both; }
@keyframes touch-rise { from { transform: translateY(18px); opacity: 0; } }
.touch-from-left { animation: touch-left .9s cubic-bezier(.2,1.2,.3,1) both; }
.touch-from-right { animation: touch-right .9s cubic-bezier(.2,1.2,.3,1) both; }
@keyframes touch-left { from { transform: translateX(-46vw) scale(.6); opacity: 0; } }
@keyframes touch-right { from { transform: translateX(46vw) scale(.6); opacity: 0; } }
.touch-spark { background: radial-gradient(circle, #fff 0%, #fde047 40%, rgba(253,224,71,0) 70%); animation: touch-spark 1.6s .7s ease-out both; }
@keyframes touch-spark { 0% { transform: scale(0); opacity: 0; } 30% { transform: scale(3.2); opacity: 1; } 100% { transform: scale(1); opacity: .9; } }
.touch-chip { border-radius: 9999px; padding: .4rem .8rem; font-size: .85rem; background: rgba(253,224,71,.12); border: 1px solid rgba(253,224,71,.35); animation: touch-rise .6s cubic-bezier(.2,.8,.2,1) both; }
.touch-glow { box-shadow: 0 0 40px rgba(253,224,71,.25); }
@media (prefers-reduced-motion: reduce) {
  .touch-ring, .touch-star, .touch-flash, .touch-pop, .touch-rise, .touch-from-left, .touch-from-right, .touch-spark, .touch-chip { animation: none !important; }
}
`;
