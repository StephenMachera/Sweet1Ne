import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sweet1NE",
  description: "Afro-Caribbean fusion. 100% Halal. South East London.",
};

/**
 * Root layout — deliberately minimal.
 *
 * The three route groups each set their own fonts and colours: (site) uses
 * Bodoni and the nocturnal palette, (staff) the gold/navy ones. Keeping the
 * root neutral means neither has to override the other.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Browser extensions (Grammarly, Bitdefender, etc.) inject their own
          attributes onto <body> before React hydrates, which React reports
          as a hydration mismatch even though nothing is actually wrong.
          suppressHydrationWarning only silences that on this exact element —
          it doesn't recurse to children, so a real mismatch anywhere else
          in the tree still surfaces normally. */}
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}