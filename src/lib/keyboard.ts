export function normalizeShortcutFromEvent(event: KeyboardEvent) {
  const parts: string[] = [];

  if (event.ctrlKey) {
    parts.push("Ctrl");
  }
  if (event.altKey) {
    parts.push("Alt");
  }
  if (event.shiftKey && event.key !== "Shift") {
    parts.push("Shift");
  }
  if (event.metaKey) {
    parts.push("Meta");
  }

  const key = normalizeKey(event.key);
  if (!["Control", "Alt", "Shift", "Meta"].includes(key)) {
    parts.push(key);
  }

  return parts.join("+");
}

export function normalizeKey(key: string) {
  if (key === " ") {
    return "Space";
  }

  if (key.length === 1) {
    return key.toUpperCase();
  }

  return key;
}

export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}
