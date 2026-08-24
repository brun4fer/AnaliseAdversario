"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Goal, UserPlus } from "lucide-react";
import { useState } from "react";

import { Button, FieldLabel, Panel, TextInput } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, confirmPassword }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        setError(data.error || "The account could not be created.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not connect to the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <Panel className="w-full max-w-md p-7">
        <div className="mb-7 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200"><Goal /></span>
          <div>
            <p className="text-xs uppercase tracking-[.22em] text-cyan-200/70">Opponent analysis</p>
            <h1 className="text-2xl font-semibold text-white">Create account</h1>
          </div>
        </div>
        <p className="mb-6 text-sm leading-6 text-slate-400">Create your private workspace. Your matches, analyses and videos will only be available in your account.</p>
        <form onSubmit={submit} className="grid gap-4">
          {error ? <div className="rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div> : null}
          <label className="grid gap-2">
            <FieldLabel>Username</FieldLabel>
            <TextInput autoFocus autoComplete="username" minLength={3} maxLength={32} value={username} onChange={(event) => setUsername(event.target.value)} required />
            <span className="text-xs text-slate-500">3–32 characters. Letters, numbers, dots, underscores and hyphens.</span>
          </label>
          <label className="grid gap-2">
            <FieldLabel>Password</FieldLabel>
            <TextInput type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
            <span className="text-xs text-slate-500">At least 8 characters, with uppercase, lowercase and a number.</span>
          </label>
          <label className="grid gap-2">
            <FieldLabel>Confirm password</FieldLabel>
            <TextInput type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
          </label>
          <Button variant="primary" size="lg" disabled={busy}><UserPlus size={17} />{busy ? "Creating account..." : "Create account"}</Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">Already have an account? <Link href="/login" className="font-medium text-cyan-200 hover:text-cyan-100">Sign in</Link></p>
      </Panel>
    </div>
  );
}
