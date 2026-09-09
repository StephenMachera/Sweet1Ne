import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, List, Section } from "@/components/site/legal-layout";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms governing use of sweet1ne.com.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Lewisham &amp; Chingford"
      title="Terms of Service"
      version="0.9"
      effective="8 September 2026"
    >
      <Section number={1} title="These terms">
        <p>
          These terms govern use of sweet1ne.com (the "Site"). The Site is for
          Sweet1ne's restaurants in Lewisham (2 Loampit Hill, SE13 7SW) and
          Chingford (164 Station Road, E4 6AN). Sweet1neLIVE is a different
          website. These terms apply only to sweet1ne.com.
        </p>

        <p>
          By using the Site you agree to these terms. If you do not agree, do not
          use the Site.
        </p>

        <p>
          The Site is operated by Ikoyi by Sweet1ne Ltd (company no. 15261613),
          registered at 2 Loampit Hill, London SE13 7SW, trading as Sweet1ne.
          Contact:{" "}
          <a href="mailto:info@sweet1ne.com" className="text-[var(--gold)]">
            info@sweet1ne.com
          </a>
          .
        </p>

        <p>
          England and Wales law applies. The courts of England and Wales have
          exclusive jurisdiction, except that we may still seek relief in another
          court to protect our rights.
        </p>
      </Section>

      <Section number={2} title="What this Site does — and does not">
        <p>The Site shows menus, locations, stories and ways to:</p>

        <List
          items={[
            "Reserve a table via SevenRooms (email confirmation from SevenRooms; we do not send booking SMS).",
            "Order collection via Toast at Lewisham and Chingford.",
            "Send catering and private hire enquiries.",
            "Join VIP and offers if you choose (separate email and SMS boxes).",
          ]}
        />

        <p>
          The Site is provided by GlobalSolutions X Spectre Ltd as technology
          processor. Website hosting is with Vercel, server hosting with Hetzner
          Online GmbH, and database hosting with Supabase.
        </p>

        <p>
          The Site does not take card numbers on our own checkout, replace
          SevenRooms or Toast, or offer delivery as an order type on this
          website. Third-party delivery apps, if any, are not part of this Site.
        </p>

        <p>
          When you Reserve or Order you also deal with SevenRooms or Toast under
          their terms and privacy notices. We are not those companies.
        </p>
      </Section>

      <Section number={3} title="Accounts">
        <p>
          You do not need a member login to browse. Staff admin accounts are for
          authorised people only.
        </p>
      </Section>

      <Section number={4} title="Reservations (SevenRooms)">
        <p>
          A completed reservation is a booking with Sweet1ne through SevenRooms,
          not a contract with GlobalSolutions X Spectre Ltd or Influx.
        </p>

        <p>
          Each restaurant has its own booking widget (guests, date, time). You
          will be asked for a card in SevenRooms when you book. That is
          SevenRooms' checkout, not a card form on sweet1ne.com. Any hold,
          deposit or charge — including if you do not arrive or cancel late — is
          as shown in that booking flow and confirmation.
        </p>

        <p className="text-[var(--ivory)]">Late arrivals</p>
        <p>
          We allow a 15-minute grace period. If you arrive significantly later
          than the reservation time, we may not be able to seat you.
        </p>

        <p className="text-[var(--ivory)]">Large parties and no times</p>
        <p>
          Bookings of 12 or more, or dates with no matching availability, should
          be left as a request. That is not a confirmed table until the team
          follows up and confirms.
        </p>

        <p className="text-[var(--ivory)]">Children at weekends</p>
        <p>
          Kids are not permitted on the terrace after 6pm, or in the restaurant
          after 8pm, on weekends.
        </p>

        <p>
          Party size, time and branch must be accurate. Show up, or cancel,
          according to the confirmation. We may refuse or cancel a booking — for
          example on grounds of safety, capacity, licence, or suspected misuse.
        </p>
      </Section>

      <Section number={5} title="Orders (Toast)">
        <p>
          Lewisham and Chingford both offer collection orders on this Site,
          placed and paid on Toast. This Site does not offer online delivery for
          either restaurant. Delivery, if available at all, is only through
          third-party apps, not through sweet1ne.com.
        </p>

        <p className="border-l border-[var(--hairline)] pl-5">
          <strong className="text-[var(--ivory)]">Allergies.</strong> The Site
          menu is a guide. Speak to the venue if you have an allergy. We are not
          liable for menu copy being incomplete if you did not confirm with
          staff.
        </p>
      </Section>

      <Section number={6} title="Enquiries">
        <p>
          Catering and hire forms are enquiries, not a confirmed booking until we
          say so in writing. Email is enough.
        </p>
      </Section>

      <Section number={7} title="Marketing">
        <p>
          Email and SMS offers are sent only as described in the{" "}
          <Link href="/privacy" className="text-[var(--gold)]">
            Privacy Notice
          </Link>
          . Separate unticked boxes. You can unsubscribe or stop texts at any
          time. A booking or order is not marketing consent.
        </p>
      </Section>

      <Section number={8} title="Reviews and promotions">
        <p>
          We may display real third-party quotes. A prize promotion, if Sweet1ne
          ever run one, will have its own terms page.
        </p>
      </Section>

      <Section number={9} title="Acceptable use">
        <p>
          Do not misuse the Site — attacking it, scraping at a volume that harms
          the service, submitting false bookings, or uploading unlawful content.
          We may block access.
        </p>
      </Section>

      <Section number={10} title="Alcohol">
        <p>
          Alcohol is sold only in line with our licence and the law. We may
          refuse service.
        </p>
      </Section>

      <Section number={11} title="Intellectual property">
        <p>
          Menus, copy, logos, photos and film on the Site belong to Sweet1ne or
          its licensors, including materials from our videographer library. You
          may not copy them for a commercial purpose without permission.
        </p>
      </Section>

      <Section number={12} title="Third-party sites and widgets">
        <p>
          Links and embeds — maps, social, SevenRooms, Toast — are outside our
          control once you leave or interact with that provider.
        </p>
      </Section>

      <Section number={13} title="Liability">
        <p>
          The Site is provided as a practical way to find us and start a booking
          or order. We do not warrant that it is uninterrupted or error-free.
        </p>

        <p>
          Nothing in these terms limits liability for death or personal injury
          caused by negligence, for fraud, or for any liability that cannot be
          limited by law.
        </p>

        <p>Subject to that, we are not liable for:</p>

        <List
          items={[
            "Loss of profit or data.",
            "The acts of SevenRooms, Toast, our hosting providers, payment networks, or your device.",
            "Events outside reasonable control.",
          ]}
        />

        <p>
          Our total liability arising from use of the Site is limited to £100, or
          the amount you paid us via the Site in the 12 months before the claim
          if that is higher.
        </p>
      </Section>

      <Section number={14} title="Privacy">
        <p>
          Personal information, cookies and similar tools are handled under the{" "}
          <Link href="/privacy" className="text-[var(--gold)]">
            Privacy Notice
          </Link>
          .
        </p>
      </Section>

      <Section number={15} title="Changes">
        <p>
          We may update these terms. The version in the footer applies from its
          effective date. Continued use is acceptance of the new terms.
        </p>
      </Section>

      <Section number={16} title="Contact">
        <p>
          <a href="mailto:info@sweet1ne.com" className="text-[var(--gold)]">
            info@sweet1ne.com
          </a>
        </p>

        <List
          items={[
            <>
              Lewisham:{" "}
              <a href="tel:+442033406750" className="text-[var(--ivory)]">
                020 3340 6750
              </a>
            </>,
            <>
              Chingford:{" "}
              <a href="tel:+442039713449" className="text-[var(--ivory)]">
                020 3971 3449
              </a>
            </>,
          ]}
        />
      </Section>
    </LegalPage>
  );
}