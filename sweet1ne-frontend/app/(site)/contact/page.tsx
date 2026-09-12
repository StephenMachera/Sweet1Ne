import type { Metadata } from "next";
import { ContactRooms } from "@/components/site/contact-rooms";
import { ContactForm } from "@/components/site/contact-form";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Ring Sweet1NE Lewisham or Chingford, or write to us — private hire, press, or a question about the menu.",
};

export default function ContactPage() {
  return (
    <>
      <section className="w-full px-[1.15rem] pb-[1.15rem] pt-[5.4rem] text-left sm:px-6 sm:pt-[5.8rem]">
        <p className="mb-[0.55rem] text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
          Contact
        </p>

        <h1 className="mb-[0.65rem] font-display text-[clamp(2.2rem,6vw,3.9rem)] font-medium leading-[1.04] tracking-[-0.02em]">
          Ring us, write.
        </h1>

        <p className="max-w-[40rem] text-[1.02rem] text-[var(--ivory-dim)]">
          The phone is quickest during opening hours. Hire, press, or a
          question — the form reaches the same people.
        </p>
      </section>

      <ContactRooms />

      <section
        id="write"
        className="mx-auto max-w-[40rem] scroll-mt-28 px-[1.15rem] py-8 sm:px-6 sm:py-[2.6rem]"
      >
        <p className="mb-[0.55rem] text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
          Write
        </p>

        <h2 className="mb-[0.65rem] font-display text-[clamp(1.9rem,4vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.02em]">
          Send a message.
        </h2>

        <p className="mb-4 max-w-[36rem] text-[var(--ivory-dim)]">
          Private hire, press, or a question about the menu. It reaches the same
          people.
        </p>

        
        <a  href="mailto:info@sweet1ne.com"
          className="mb-7 inline-block border-b border-[rgba(201,162,74,.55)] pb-[0.12rem] text-[var(--ivory)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
        >
          info@sweet1ne.com
        </a>

        <ContactForm />
      </section>

      <section className="px-[1.15rem] pb-12 pt-4 text-center sm:px-6">
        <p className="font-display text-[clamp(1.4rem,3vw,2rem)] italic">
          Always in the mood for you.
        </p>
      </section>

      <SiteFooter />
    </>
  );
}