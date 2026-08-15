"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_PASSWORD_LENGTH = 8;

export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // A stale session already sitting in this browser (e.g. the admin who sent
    // the invite, testing in the same tab) must never be mistaken for the
    // invited staff member's session — only trust it if the URL itself is
    // carrying fresh invite/recovery tokens from the email link.
    const hasCallbackTokens =
      window.location.hash.includes("access_token") ||
      new URLSearchParams(window.location.search).has("code");

    if (!hasCallbackTokens) {
      setError("This invitation link is invalid or has expired. Ask your manager to send a new one.");
      setReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setError("This invitation link is invalid or has expired. Ask your manager to send a new one.");
      }
      setReady(true);
    });
  }, [supabase]);

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
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/login");
  }

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-[45%] overflow-hidden bg-gradient-to-b from-ink-cool to-ink-cool-deep md:block">
        <div className="flex h-full flex-col justify-between p-12">
          <span className="font-display text-2xl tracking-tight text-paper">Sweet1NE</span>
          <div className="max-w-sm">
            <h2 className="font-display text-2xl leading-snug text-paper/90">
              Welcome to the team.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-paper/50">
              Choose a password and you'll be ready to sign in.
            </p>
          </div>
          <div>
            <div
              className="h-px w-24 text-paper opacity-30"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, currentColor 0 4px, transparent 4px 8px)",
              }}
            />
            <p className="mt-4 text-sm text-paper/50">Set your password</p>
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-paper px-6 md:w-[55%]">
        <form onSubmit={handleSubmit} className="w-full max-w-md py-16">
          <fieldset disabled={loading || !ready || !!error} className="space-y-8">
            <div className="space-y-1">
              <span className="font-display text-2xl text-ink md:hidden">Sweet1NE</span>
              <h1 className="font-display text-2xl text-ink max-md:hidden">Set your password</h1>
              <p className="text-sm text-ink-muted md:hidden">Set your password</p>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-md border border-ember/30 bg-ember/5 px-4 py-3 text-sm text-ember"
              >
                {error}
              </div>
            )}

            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pr-12 text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center text-ink-muted hover:text-ink"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-ink-muted">At least {MIN_PASSWORD_LENGTH} characters.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !ready}
              className="h-12 w-full bg-gold text-base text-ink hover:bg-gold/90"
            >
              {loading ? "Saving…" : "Set password and continue"}
            </Button>
          </fieldset>
        </form>
      </div>
    </div>
  );
}