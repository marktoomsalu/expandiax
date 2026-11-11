"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";
import { isNativePlatform } from "./capacitor";

/**
 * The keyboard's height while the chat is open, on iPhone, so the chat can
 * rise with it smoothly.
 *
 * Normally the app resizes the whole page about half a second after the
 * keyboard starts coming up, and iOS nudges the page meanwhile: a quick
 * double jump. While the chat is open the page is held still instead (no
 * resizing, no nudging, the page behind kept where it was) and the chat
 * moves itself, at the keyboard's pace. Everything goes back as it was
 * when the chat closes.
 */
export function useChatKeyboard() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!isNativePlatform() || Capacitor.getPlatform() !== "ios") return;
    // Hold the page behind still, where it was.
    const y = window.scrollY;
    const body = document.body.style;
    const before = { position: body.position, top: body.top, left: body.left, right: body.right, width: body.width };
    Object.assign(body, { position: "fixed", top: `-${y}px`, left: "0", right: "0", width: "100%" });

    void Keyboard.setResizeMode({ mode: KeyboardResize.None }).catch(() => {});
    void Keyboard.setScroll({ isDisabled: true }).catch(() => {});
    const show = Keyboard.addListener("keyboardWillShow", (info) => setHeight(info.keyboardHeight));
    const hide = Keyboard.addListener("keyboardWillHide", () => setHeight(0));

    return () => {
      void show.then((l) => l.remove());
      void hide.then((l) => l.remove());
      void Keyboard.setScroll({ isDisabled: false }).catch(() => {});
      void Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {});
      Object.assign(body, before);
      window.scrollTo(0, y);
    };
  }, []);

  return height;
}
