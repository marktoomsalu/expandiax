// Once someone has started Touch globes (and so answered the iPhone's
// questions about finding devices nearby), the app keeps quietly listening
// for a touch on every screen. Remembered on this phone only.
const KEY = "expandiax.touchGlobes";

export function isTouchReady(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setTouchReady() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Private mode: the screen still works, just not from everywhere.
  }
}
