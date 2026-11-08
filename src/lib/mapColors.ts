// The map's colours, shared by the globe and its legend so they can't drift
// apart. Logo-matched: home is the logo's pink (#FA51A2), a first-time
// visit the logo's orange (#FB7822) — together they read as the brand
// gradient. The more times a country's been visited, the further its
// orange drifts toward home's pink (almost a second home) — but capped
// well short of it, so home always reads as uniquely "home."
export const HOME_RGB = { r: 250, g: 81, b: 162 }; // #FA51A2
export const VISITED_RGB = { r: 251, g: 120, b: 34 }; // #FB7822
export const VISITED_MAX_BLEND = 0.7;
export const VISITED_BLEND_VISITS = 5;
export const DREAM_RGB = { r: 139, g: 92, b: 246 };

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

/** A visited country's colour after `count` visits. */
export function visitedColor(count: number, alpha = 1): string {
  const progress = Math.min(1, Math.max(0, (count - 1) / VISITED_BLEND_VISITS));
  const t = progress * VISITED_MAX_BLEND;
  return `rgba(${lerp(VISITED_RGB.r, HOME_RGB.r, t)},${lerp(VISITED_RGB.g, HOME_RGB.g, t)},${lerp(VISITED_RGB.b, HOME_RGB.b, t)},${alpha})`;
}

export const rgb = (c: { r: number; g: number; b: number }) => `rgb(${c.r},${c.g},${c.b})`;
