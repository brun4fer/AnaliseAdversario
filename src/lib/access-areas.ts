export const accessAreas = ["dashboard", "newMatch", "reports", "maintenance", "settings", "analysis"] as const;
export type AccessArea = typeof accessAreas[number];

export const accessAreaDetails: Record<AccessArea, { label: string; defaultPassword: string }> = {
  dashboard: { label: "Dashboard", defaultPassword: "dashboard" },
  newMatch: { label: "New match", defaultPassword: "newmatch" },
  reports: { label: "Reports", defaultPassword: "reports" },
  maintenance: { label: "Maintenance", defaultPassword: "maintenance" },
  settings: { label: "Settings", defaultPassword: "settings" },
  analysis: { label: "Analysis", defaultPassword: "analysis" },
};

export const globalAccessDefaultPassword = "global";
// Temporarily disabled: keep the complete area-password feature ready to reactivate.
export const areaPasswordsEnabled = false;
export function isAccessArea(value: unknown): value is AccessArea { return typeof value === "string" && accessAreas.includes(value as AccessArea); }
export function accessAreaForPath(pathname: string): AccessArea | null {
  if (pathname === "/") return "dashboard";
  if (pathname === "/matches/new" || pathname.startsWith("/matches/new/")) return "newMatch";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/maintenance")) return "maintenance";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/analysis")) return "analysis";
  if (/^\/matches\/[^/]+\/edit$/.test(pathname)) return "dashboard";
  return null;
}
