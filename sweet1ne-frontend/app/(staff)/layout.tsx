import { Bodoni_Moda, Fraunces, Hanken_Grotesk, IBM_Plex_Mono, Inter } from "next/font/google";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

// Admin-only faces, on their own variable names so the branch console's
// Fraunces/Inter above are untouched. .admin-shell (in globals.css)
// reroutes --font-display/--font-body to these within the /admin subtree.
const adminDisplay = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-admin-display",
  weight: ["400", "500", "600"],
});

const adminBody = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-admin-body",
  weight: ["400", "500", "600"],
});

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${display.variable} ${body.variable} ${mono.variable} ${adminDisplay.variable} ${adminBody.variable} min-h-screen bg-paper font-body text-ink`}
    >
      {children}
    </div>
  );
}