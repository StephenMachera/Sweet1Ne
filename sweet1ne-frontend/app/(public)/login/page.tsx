"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bodoni_Moda, Hanken_Grotesk } from "next/font/google";
import { createClient } from "@/lib/supabase/client";
import { landingPath } from "@/lib/use-me";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

const gateDisplay = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-gate-display",
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

const gateBody = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-gate-body",
  weight: ["400", "500", "600"],
});

export default function login() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      password,
      email,
    });

    if (authError || !data.session) {
      setLoading(false);
      setError("That email or password isn't right. Please try again.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });

      if (!response.ok) {
        throw new Error("Your account isn't set up for access yet. Contact your manager.");
      }

      const me = await response.json();
      const destination = landingPath(me);

      router.push(destination);
      router.refresh();
    } catch (err) {
      await supabase.auth.signOut();
      setLoading(false);
      setError(
        err instanceof Error ? err.message : "Couldn't reach the server. Please try again."
      );
    }
  }

  return (
    <div className={`gate-shell ${gateDisplay.variable} ${gateBody.variable}`}>
      <main className="gate-card">
        <img className="mark" src="/images/homepage-gallery/story/logo.png" alt="Sweet1NE" />
        <hr />
        <p className="slogan">Always in the mood for you.</p>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <fieldset disabled={loading} className="contents">
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="book" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </fieldset>
        </form>

        <p className="hint">Need an account? Ask your manager to create one for you.</p>
      </main>
    </div>
  );
}
