"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Typewriter } from "@/components/public/typewriter";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const MIN_PASSWORD_LENGTH = 8;

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export default function SignupPage() {
  const router = useRouter();
  const [tenantName, setTenantName] = useState("");
  const [slugOverride, setSlugOverride] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const tenantSlug = slugOverride ?? slugify(tenantName);

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_name: tenantName,
          tenant_slug: tenantSlug,
          full_name: fullName,
          email,
          password,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Setup failed (${res.status}). Please try again.`);
      }

      router.push("/login");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't reach the server. Check your connection and try again."
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-[45%] overflow-hidden bg-gradient-to-b from-ink-cool to-ink-cool-deep md:block">
        <div className="relative flex h-full flex-col justify-between p-12">
          <span className="font-display text-2xl tracking-tight text-paper">Sweet1NE</span>

          <div className="max-w-sm">
            <p className="mb-6 text-xs uppercase tracking-[0.2em] text-paper/40">Welcome</p>
            <h2 className="font-display text-xl leading-snug text-paper/90">
              Everything your floor, kitchen and bar need — in one place.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-paper/50">
              You're a few details away from having Sweet1NE ready across every branch.
            </p>
            <div className="mt-10">
              <Typewriter />
            </div>
          </div>

          <div>
            <div
              className="h-px w-24 text-paper opacity-30"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, currentColor 0 4px, transparent 4px 8px)",
              }}
            />
            <p className="mt-4 text-sm text-paper/50">Set up your company</p>
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-paper px-6 md:w-[55%]">
        <form onSubmit={handleSubmit} className="w-full max-w-md py-16">
          <fieldset disabled={loading} className="space-y-8">
            <div className="space-y-1 md:hidden">
              <span className="font-display text-2xl text-ink">Sweet1NE</span>
              <p className="text-sm text-ink-muted">Set up your company</p>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-md border border-ember/30 bg-ember/5 px-4 py-3 text-sm text-ember"
              >
                {error}
              </div>
            )}

            <p className="text-sm text-ink-muted">
              This creates Sweet1NE's account for the first time. You'll be its Director,
              with full access across every branch.
            </p>

            <section className="space-y-4">
              <h2 className="font-display text-lg text-ink">Company details</h2>
              <div className="space-y-1">
                <Label htmlFor="tenantName">Company name</Label>
                <Input
                  id="tenantName"
                  required
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                />

                {tenantName && !editingSlug && (
                  <p className="text-xs text-ink-muted">
                    URL: sweet1ne.com/<span className="font-mono">{tenantSlug}</span>{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setSlugOverride(tenantSlug);
                        setEditingSlug(true);
                      }}
                      className="ml-1 underline hover:text-ink"
                    >
                      edit
                    </button>
                  </p>
                )}

                {editingSlug && (
                  <div className="space-y-1 pt-2">
                    <Label htmlFor="slug" className="text-xs">
                      Company URL
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-muted">sweet1ne.com/</span>
                      <Input
                        id="slug"
                        value={slugOverride ?? ""}
                        onChange={(e) => setSlugOverride(slugify(e.target.value))}
                        className="font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="font-display text-lg text-ink">Your director account</h2>

              <div className="space-y-1">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className={`text-xs ${passwordTooShort ? "text-ember" : "text-ink-muted"}`}>
                  At least {MIN_PASSWORD_LENGTH} characters.
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {passwordsMismatch && (
                  <p className="text-xs text-ember">Passwords don't match.</p>
                )}
              </div>
            </section>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gold text-ink hover:bg-gold/90"
            >
              {loading ? "Creating…" : "Create Company & Director Account"}
            </Button>
          </fieldset>
        </form>
      </div>
    </div>
  );
}