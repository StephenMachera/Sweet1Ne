"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Camera, QrCode, ShoppingBag, Utensils } from "lucide-react";
import { Eyebrow } from "./section";
import { SplitReveal } from "./motion/split-reveal";
import { QrScanner, scannerSupported } from "./qr-scanner";
import { TakeawayFlow } from "./takeaway-flow"

type Choice = null | "dine-in" | "takeaway";

/**
 * The fork.
 *
 * Someone sitting at a table and someone planning a collection are in
 * completely different situations — one needs to scan and go, the other
 * needs to browse, choose a time and leave a number. So the page opens with
 * two doors rather than one compromise.
 */
export function OrderChoice() {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice>(null);
  const [scanning, setScanning] = useState(false);
  const [canScan, setCanScan] = useState(false);

  useEffect(() => {
    setCanScan(scannerSupported());
  }, []);

  function handleScan(value: string) {
    setScanning(false);

    // The code encodes a full URL — /{branch}/order?table={token}. Take the
    // path from it rather than trusting the host, so a code from elsewhere
    // can't redirect someone off-site.
    try {
      const url = new URL(value);
      router.push(`${url.pathname}${url.search}`);
    } catch {
      // Not a URL — treat it as a bare token and hope the branch resolves.
      router.push(`/order?table=${encodeURIComponent(value)}`);
    }
  }

  if (scanning) {
    return <QrScanner onDetected={handleScan} onClose={() => setScanning(false)} />;
  }

  if (choice === "takeaway") {
    return <TakeawayFlow onBack={() => setChoice(null)} />;
  }

  if (choice === "dine-in") {
    return (
      <section className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden pt-24">
        <div className="glow left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2" />

        <div className="relative mx-auto w-full max-w-lg px-5 text-center sm:px-8">
          <button
            onClick={() => setChoice(null)}
            className="mb-10 inline-flex items-center gap-2 text-sm text-[var(--ivory-dim)] hover:text-[var(--gold)]"
          >
            <ArrowLeft size={15} strokeWidth={1} />
            Back
          </button>

          <QrCode size={40} strokeWidth={0.75} className="mx-auto text-[var(--gold)]" />

          <h1 className="mt-8 font-display text-[clamp(2rem,7vw,3rem)] leading-tight">
            There's a code on your table
          </h1>

          <p className="mt-5 leading-relaxed text-[var(--ivory-dim)]">
            Scan it and the menu opens with your table already set — order
            without waiting for anyone.
          </p>

          {canScan ? (
            <>
              <button
                onClick={() => setScanning(true)}
                className="mt-10 inline-flex w-full items-center justify-center gap-2.5 bg-[var(--gold)] py-5 text-base font-semibold text-[#0e0e0e] transition-colors hover:bg-[var(--gold-deep)]"
                style={{ borderRadius: "4px" }}
              >
                <Camera size={20} strokeWidth={1.5} />
                Scan the code
              </button>

              <p className="mt-4 text-sm text-[var(--muted)]">
                Or point your phone's camera at it — either works.
              </p>
            </>
          ) : (
            // No BarcodeDetector — iOS Safari, mostly. The camera app does
            // the same job, so say that plainly rather than apologising.
            <div
              className="mt-10 border border-[var(--hairline)] p-6"
              style={{ borderRadius: "4px" }}
            >
              <p className="text-[var(--ivory)]">
                Open your phone's camera and point it at the code.
              </p>
              <p className="mt-2 text-sm text-[var(--ivory-dim)]">
                A link will pop up — tap it and you're in.
              </p>
            </div>
          )}

          <p className="mt-10 text-sm text-[var(--muted)]">
            Can't find the code? Ask any member of staff.
          </p>
        </div>
      </section>
    );
  }

  // The fork itself.
  return (
    <section className="relative min-h-[100svh] pt-32 sm:pt-40">
      <div className="glow left-1/4 top-0 h-[400px] w-[400px]" />

      <div className="relative mx-auto max-w-[1440px] px-5 pb-20 sm:px-8 lg:px-12">
        <Eyebrow>Order now</Eyebrow>
        <SplitReveal
          as="h1"
          className="font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95] tracking-[-0.02em]"
        >
          {"Where are\nyou eating?"}
        </SplitReveal>

        <div className="mt-12 grid gap-4 lg:grid-cols-2 lg:gap-6">
          {/* Here */}
          <button
            onClick={() => setChoice("dine-in")}
            className="group relative aspect-[4/5] overflow-hidden text-left sm:aspect-[16/10] lg:aspect-[4/5]"
          >
            <Image
              src="/images/interiors/order-dine-in.jpg"
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/20 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <Utensils size={24} strokeWidth={1} className="text-[var(--gold)]" />
              <h2 className="mt-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight">
                I'm here now
              </h2>
              <p className="mt-2 max-w-xs leading-relaxed text-[var(--ivory-dim)]">
                Scan the code on your table and order straight from your seat.
              </p>
            </div>

            <div className="pointer-events-none absolute inset-0 border border-transparent transition-colors duration-500 group-hover:border-[var(--hairline)]" />
          </button>

          {/* Collection */}
          <button
            onClick={() => setChoice("takeaway")}
            className="group relative aspect-[4/5] overflow-hidden text-left sm:aspect-[16/10] lg:aspect-[4/5]"
          >
            <Image
              src="/images/food/order-takeaway.jpg"
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/20 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <ShoppingBag size={24} strokeWidth={1} className="text-[var(--gold)]" />
              <h2 className="mt-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight">
                Taking it away
              </h2>
              <p className="mt-2 max-w-xs leading-relaxed text-[var(--ivory-dim)]">
                Order for collection and pick it up when it's ready.
              </p>
            </div>

            <div className="pointer-events-none absolute inset-0 border border-transparent transition-colors duration-500 group-hover:border-[var(--hairline)]" />
          </button>
        </div>

        {/* Delivery is someone else's job. */}
        <div className="mt-12 border-t border-[var(--hairline-faint)] pt-8">
          <p className="text-sm text-[var(--ivory-dim)]">
            Want it delivered instead?{" "}
            <a
              href="https://deliveroo.co.uk"
              target="_blank"
              rel="noreferrer"
              className="border-b border-[var(--ivory)]/30 hover:border-[var(--gold)] hover:text-[var(--gold)]"
            >
              Deliveroo
            </a>{" "}
            and{" "}
            
            <a  href="https://ubereats.com"
              target="_blank"
              rel="noreferrer"
              className="border-b border-[var(--ivory)]/30 hover:border-[var(--gold)] hover:text-[var(--gold)]"
            >
              Uber Eats
            </a>{" "}
            cover East and South East London.
          </p>
        </div>
      </div>
    </section>
  );
}