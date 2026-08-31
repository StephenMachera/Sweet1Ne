import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";

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

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${display.variable} ${body.variable} ${mono.variable} min-h-screen bg-paper font-body text-ink`}
    >
      {children}
    </div>
  );
}