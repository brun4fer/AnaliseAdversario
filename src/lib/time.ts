export function formatTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds)) {
    return "00:00";
  }

  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function formatPreciseTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds)) {
    return "00:00.0";
  }

  const whole = Math.floor(Math.max(0, totalSeconds));
  const tenths = Math.floor((Math.max(0, totalSeconds) - whole) * 10);
  return `${formatTime(whole)}.${tenths}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function roundSeconds(value: number) {
  return Math.round(value * 10) / 10;
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
