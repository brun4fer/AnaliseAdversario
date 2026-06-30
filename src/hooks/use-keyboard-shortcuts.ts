"use client";

import { useEffect } from "react";

import { isEditableTarget, normalizeShortcutFromEvent } from "@/lib/keyboard";

export type ShortcutBinding = {
  key: string;
  handler: () => void;
  preventDefault?: boolean;
};

export function useKeyboardShortcuts(bindings: ShortcutBinding[], enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      const shortcut = normalizeShortcutFromEvent(event);
      const binding = bindings.find((item) => item.key === shortcut);

      if (!binding) {
        return;
      }

      if (binding.preventDefault !== false) {
        event.preventDefault();
      }
      binding.handler();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [bindings, enabled]);
}
