"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Goal, LogIn } from "lucide-react";
import { Button, FieldLabel, Panel, TextInput } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(""); const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) }); const data = await response.json(); setBusy(false); if (!response.ok) return setError(data.error); const next = new URLSearchParams(window.location.search).get("next"); router.replace(data.mustChangePassword ? "/change-password" : (next || "/")); router.refresh(); }
  return <div className="flex min-h-screen items-center justify-center px-4"><Panel className="w-full max-w-md p-7"><div className="mb-7 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200"><Goal /></span><div><p className="text-xs uppercase tracking-[.22em] text-cyan-200/70">Opponent analysis</p><h1 className="text-2xl font-semibold text-white">Sign in</h1></div></div><form onSubmit={submit} className="grid gap-4">{error && <div className="rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>}<label className="grid gap-2"><FieldLabel>Username</FieldLabel><TextInput autoFocus autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required /></label><label className="grid gap-2"><FieldLabel>Password</FieldLabel><TextInput type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></label><Button variant="primary" size="lg" disabled={busy}><LogIn size={17}/>{busy ? "Signing in..." : "Sign in"}</Button></form></Panel></div>;
}
