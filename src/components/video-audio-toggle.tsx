"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui";

const storageKey = "ap-sound-enabled";

export function useSoundPreference() {
  const [soundEnabled, setSoundEnabledState] = useState(false);
  useEffect(() => { setSoundEnabledState(window.localStorage.getItem(storageKey) === "1"); }, []);
  function setSoundEnabled(enabled: boolean) {
    setSoundEnabledState(enabled);
    window.localStorage.setItem(storageKey, enabled ? "1" : "0");
    window.dispatchEvent(new CustomEvent("ap-sound-change", { detail: enabled }));
  }
  useEffect(() => {
    const listener = (event: Event) => setSoundEnabledState(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("ap-sound-change", listener);
    return () => window.removeEventListener("ap-sound-change", listener);
  }, []);
  return { soundEnabled, setSoundEnabled };
}

export function VideoAudioToggle({ soundEnabled, onChange, className = "h-8 w-8" }: { soundEnabled: boolean; onChange: (enabled: boolean) => void; className?: string }) {
  return <Button type="button" size="icon" variant="secondary" className={className} onClick={() => onChange(!soundEnabled)} title={soundEnabled ? "Mute video" : "Enable video sound"} aria-label={soundEnabled ? "Mute video" : "Enable video sound"}>{soundEnabled ? <Volume2 size={14}/> : <VolumeX size={14}/>}</Button>;
}
