import "server-only";
import QRCode from "qrcode";

// A QR code drawn in ExpandiaX's own style: softly rounded modules, soft corner eyes and
// a clear middle for the logo. The highest error correction (H, 30%) keeps it
// readable with the middle left out.

export type QrArt = {
  /** Modules across, plus the quiet zone on each side. */
  size: number;
  /** All the dots, as one SVG path (one unit per module). */
  dots: string;
  /** The three corner eyes' top-left corners. */
  eyes: [number, number][];
  /** The clear middle square: where it starts and how wide it is. */
  hole: { at: number; size: number };
};

const QUIET = 3;

export function qrArt(text: string): QrArt {
  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const on = (x: number, y: number) => qr.modules.get(y, x) === 1;
  const inEye = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  // About a fifth of the width, odd so it sits dead centre.
  let holeSize = Math.round(n * 0.22);
  if (holeSize % 2 === 0) holeSize++;
  const holeAt = (n - holeSize) / 2;
  const inHole = (x: number, y: number) => x >= holeAt - 0.5 && x < holeAt + holeSize + 0.5 && y >= holeAt - 0.5 && y < holeAt + holeSize + 0.5;

  // Softly rounded squares: round dots look nice but some scanners miss them.
  const k = 0.04;
  const w = 1 - 2 * k;
  const r = 0.3;
  const e = w - 2 * r;
  let dots = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!on(x, y) || inEye(x, y) || inHole(x, y)) continue;
      const left = x + QUIET + k;
      const top = y + QUIET + k;
      dots += `M${(left + r).toFixed(2)},${top.toFixed(2)}h${e.toFixed(2)}a${r},${r} 0 0 1 ${r},${r}v${e.toFixed(2)}a${r},${r} 0 0 1 ${-r},${r}h${(-e).toFixed(2)}a${r},${r} 0 0 1 ${-r},${-r}v${(-e).toFixed(2)}a${r},${r} 0 0 1 ${r},${-r}z`;
    }
  }
  return {
    size: n + QUIET * 2,
    dots,
    eyes: [
      [QUIET, QUIET],
      [n - 7 + QUIET, QUIET],
      [QUIET, n - 7 + QUIET],
    ],
    hole: { at: holeAt + QUIET, size: holeSize },
  };
}
