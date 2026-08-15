"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AwardIcon, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { landingPath } from "@/lib/use-me";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export default function login(){
    const router = useRouter();
    const supabase = createClient();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent){
        e.preventDefault()
        setError(null);
        setLoading(true);

        const {data, error:authError } = await supabase.auth.signInWithPassword({
            password,
            email
        })

        if (authError || !data.session) {
            setLoading(false);
            setError("That email or password isn't right. Please try again.");
            return;
        }

        try{
            const response = await fetch (`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${data.session.access_token}` },
            })

            if (!response.ok){
                throw new Error("Your account isn't set up for access yet. Contact your manager.");
            }

            const me = await response.json()
            const destination = landingPath(me)

            router.push(destination)
            router.refresh()
        }catch(err){
            await supabase.auth.signOut();
            setLoading(false);
            setError(
                err instanceof Error ? err.message : "Couldn't reach the server. Please try again."
            );
        }
    }

    return (
    <div className="flex min-h-screen">
      {/* Left panel — hidden below md */}
      <div className="relative hidden w-[45%] overflow-hidden bg-gradient-to-b from-ink-cool to-ink-cool-deep md:block">
        <div className="flex h-full flex-col justify-between p-12">
          <span className="font-display text-2xl tracking-tight text-paper">Sweet1NE</span>

          <div className="max-w-sm">
            <h2 className="font-display text-2xl leading-snug text-paper/90">
              Welcome back.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-paper/50">
              Sign in to pick up where your floor, kitchen and bar left off.
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
            <p className="mt-4 text-sm text-paper/50">Staff sign in</p>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex w-full items-center justify-center bg-paper px-6 md:w-[55%]">
        <form onSubmit={handleSubmit} className="w-full max-w-md py-16">
          <fieldset disabled={loading} className="space-y-8">
            <div className="space-y-1">
              <span className="font-display text-2xl text-ink md:hidden">Sweet1NE</span>
              <h1 className="font-display text-2xl text-ink max-md:hidden">Sign in</h1>
              <p className="text-sm text-ink-muted md:hidden">Staff sign in</p>
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
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
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
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full bg-gold text-base text-ink hover:bg-gold/90"
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>

            <p className="text-center text-xs text-ink-muted">
              Need an account? Ask your manager to create one for you.
            </p>
          </fieldset>
        </form>
      </div>
    </div>
  );
}