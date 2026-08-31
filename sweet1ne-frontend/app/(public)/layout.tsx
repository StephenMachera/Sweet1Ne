import { Fraunces, Inter } from "next/font/google";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${body.variable} font-body text-ink`}>
      {children}
    </div>
  );
}