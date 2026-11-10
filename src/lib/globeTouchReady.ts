// Whether Touch globes is on for this phone (it then listens on every
// screen, like AirDrop), and whether we've already asked. Remembered on
// this phone only.
const KEY = "expandiax.touchGlobes";
const ASKED = "expandiax.touchGlobesAsked";

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function write(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Private mode: the Touch globes screen still works, just not from everywhere.
  }
}

export const isTouchReady = () => read(KEY);
export const setTouchReady = () => write(KEY);
export const isTouchAsked = () => read(ASKED);
export const setTouchAsked = () => write(ASKED);
