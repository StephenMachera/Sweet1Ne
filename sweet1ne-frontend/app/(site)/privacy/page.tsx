import type { Metadata } from "next";
import { LegalPage, List, Section, Table } from "@/components/site/legal-layout";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description: "How Sweet1NE collects, uses and protects your information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Lewisham &amp; Chingford"
      title="Privacy Notice"
      version="0.9"
      effective="8 September 2026"
    >
      <Section number={1} title="Who we are">
        <p>
          The data controller is Ikoyi by Sweet1ne Ltd (company no. 15261613),
          registered at 2 Loampit Hill, London SE13 7SW. We trade as Sweet1ne.
        </p>

        <List
          items={[
            "Lewisham: 2 Loampit Hill, London SE13 7SW · 020 3340 6750",
            "Chingford: 164 Station Road, London E4 6AN · 020 3971 3449",
          ]}
        />

        <p>
          This notice covers sweet1ne.com only. Sweet1neLIVE (Chadwell Heath) is
          a separate website of the same company. Contact for both:{" "}
          <a href="mailto:info@sweet1ne.com" className="text-[var(--gold)]">
            info@sweet1ne.com
          </a>
          .
        </p>

        <p>
          The Site is provided by GlobalSolutions X Spectre Ltd as technology
          processor for Ikoyi by Sweet1ne Ltd. Vercel provides website hosting,
          Hetzner Online GmbH provides server hosting, and Supabase provides
          database hosting.
        </p>
      </Section>

      <Section number={2} title="What this notice covers">
        <p>
          Use of sweet1ne.com: browse, choose a branch, reserve a table, start a
          collection order (Lewisham or Chingford), catering or private-hire
          enquiries, VIP and offers we run ourselves, or contact us.
        </p>

        <p>
          This Site does not take online delivery orders. Third-party delivery
          apps, if used, are not part of this Site and have their own notices.
        </p>
      </Section>

      <Section number={3} title="Information we collect">
        <List
          items={[
            <>
              <strong className="text-[var(--ivory)]">
                Identity and contact:
              </strong>{" "}
              name, email, telephone.
            </>,
            <>
              <strong className="text-[var(--ivory)]">Branch and booking:</strong>{" "}
              Lewisham or Chingford; date and time; party size (SevenRooms);
              collection and order details (Toast). A party of 12 or more, or a
              date with no times, may be a request until staff confirm — still
              the same contact and booking data.
            </>,
            <>
              <strong className="text-[var(--ivory)]">Enquiries:</strong> catering
              (name, email, phone, date, servings, comments, pickup branch);
              private hire (location, names, phone, email, event type, date and
              time, hours, party size, comments).
            </>,
            <>
              <strong className="text-[var(--ivory)]">
                VIP and marketing choice:
              </strong>{" "}
              the exact wording shown, the date, the source, email opt-in and SMS
              opt-in — each separate and unticked.
            </>,
            <>
              <strong className="text-[var(--ivory)]">Interaction data:</strong>{" "}
              pages, Reserve / Order / call / directions, and campaign tags where
              enabled.
            </>,
            <>
              <strong className="text-[var(--ivory)]">Technical data:</strong> IP,
              device, browser, online identifiers, approximate location from IP,
              and security logs.
            </>,
            <>
              <strong className="text-[var(--ivory)]">
                Dietary or allergy information
              </strong>{" "}
              you choose to give — health data, used for service only, never for
              marketing.
            </>,
            <>
              <strong className="text-[var(--ivory)]">Staff and admin accounts.</strong>
            </>,
          ]}
        />

        <p className="text-[var(--ivory)]">Cards</p>

        <p>
          We do not store full card numbers on GlobalSolutions X Spectre Ltd
          servers.
        </p>

        <List
          items={[
            <>
              <strong className="text-[var(--ivory)]">Tables:</strong> SevenRooms
              — you enter a card when you book. SevenRooms and its payment
              provider process it as a booking guarantee, which may involve a
              hold or a charge if you do not show up or cancel late. The rules
              are as shown in that flow. Dinner is paid separately.
            </>,
            <>
              <strong className="text-[var(--ivory)]">Food and collection:</strong>{" "}
              Toast, at Lewisham and Chingford. Not delivery on this Site.
            </>,
          ]}
        />
      </Section>

      <Section number={4} title="Why we use information">
        <Table
          headers={["Purpose", "Examples", "Lawful basis"]}
          rows={[
            [
              "Service you asked for",
              "Menus, SevenRooms, Toast collection, enquiries, VIP signup, support",
              "Contract steps and performance, or legitimate interests",
            ],
            [
              "Run and secure the site",
              "Logs, spam checks (reCAPTCHA), fraud, hosting and DNS",
              "Legitimate interests; legal obligation",
            ],
            [
              "Improve the site",
              "Aggregated journeys",
              "Legitimate interests; consent for non-essential cookies",
            ],
            [
              "Direct marketing",
              "Email and SMS offers, news, and similar Sweet1ne services",
              "Consent (unticked boxes), or PECR soft opt-in only where every condition is met",
            ],
            [
              "Measure campaigns",
              "After you allow advertising and analytics cookies",
              "Consent",
            ],
            [
              "Law and claims",
              "Tax, complaints",
              "Legal obligation; legitimate interests",
            ],
            [
              "Allergies",
              "Kitchen and venue only",
              "Article 6 plus an appropriate special-category condition",
            ],
          ]}
        />

        <p>
          No solely automated decisions with legal or similarly significant
          effects.
        </p>
      </Section>

      <Section number={5} title="Email and SMS marketing">
        <p>
          What you get if you opt in: from time to time, restaurant news, events,
          secret menus, offers, discounts, and loyalty or booking promotions. We
          do not promise a fixed number of messages per week.
        </p>

        <p className="text-[var(--ivory)]">How we ask</p>

        <List
          items={[
            "Email marketing and SMS marketing are separate, unticked boxes. Neither is required to browse, book a table, or order.",
            "A booking confirmation, an order receipt, or agreeing to the website terms is not marketing consent.",
          ]}
        />

        <p className="text-[var(--ivory)]">Typical wording</p>

        <div className="space-y-3 border-l border-[var(--hairline)] pl-5">
          <p>
            <strong className="text-[var(--ivory)]">Email:</strong> "I would like
            Sweet1ne to email me offers, restaurant news and booking promotions.
            I can unsubscribe at any time. See our Privacy Notice."
          </p>
          <p>
            <strong className="text-[var(--ivory)]">SMS:</strong> "I would like
            Sweet1ne to text me offers. This is optional. I can stop texts at any
            time by emailing info@sweet1ne.com or following the stop instruction
            in a message. See our Privacy Notice."
          </p>
        </div>

        <p className="text-[var(--ivory)]">Stopping</p>

        <p>
          Use the unsubscribe link in any email, or reply STOP to a text, or
          email{" "}
          <a href="mailto:info@sweet1ne.com" className="text-[var(--gold)]">
            info@sweet1ne.com
          </a>
          . We keep a minimal suppression record so that we do not contact you
          again.
        </p>

        <p>
          Soft opt-in applies only to our own similar services, where details
          were collected in a sale or a genuine discussion of a sale, with an
          opt-out offered at collection and in every later message. We do not buy
          or scrape lists. Influx use a list only when Sweet1ne instruct, and not
          a SevenRooms booking email unless a lawful route is recorded.
        </p>

        <p>
          We review unconverted leads after 12 months of inactivity, and keep
          consent evidence for as long as needed to show permission.
        </p>

        <p>
          Table confirmations are sent by email from SevenRooms. We do not send
          booking SMS.
        </p>
      </Section>

      <Section number={6} title="Reviews">
        <p>
          We may show real Google or similar quotes. We will not invent scores.
          If Sweet1ne later add a review or prize feature, we will update this
          notice and, for a prize, publish separate promotion terms.
        </p>
      </Section>

      <Section number={7} title="Cookies, pixels and reCAPTCHA">
        <p>
          A consent banner lets you accept or reject non-essential tools, with a
          way to change your mind later. This is not "by using this site you
          agree."
        </p>

        <p className="text-[var(--ivory)]">
          Necessary — these run without consent
        </p>

        <p>
          Security, session, storing your cookie choice, and starting a Reserve
          or Order.
        </p>

        <p className="text-[var(--ivory)]">Off until you consent</p>

        <p>
          GA4, Google Ads, the Meta Pixel, and other marketing or analytics tags,
          including tags loaded for Sweet1ne's marketing agency.
        </p>

        <p>
          Google reCAPTCHA runs on enquiry forms — catering, hire and contact
          where used. Google receives IP, device and interaction data to score
          bots. That is fingerprinting. We disclose it here; it is not switched
          on as hidden analytics.
        </p>

        <p>
          SevenRooms and Toast set their own cookies on Reserve and Order.
          Rejecting non-essential cookies will not stop you reading the menu or
          opening Reserve or Order.
        </p>
      </Section>

      <Section number={8} title="Who receives information">
        <Table
          headers={["Party", "Role", "What typically goes to them"]}
          rows={[
            [
              "Ikoyi by Sweet1ne Ltd",
              "Controller",
              "All purposes in this notice",
            ],
            [
              "GlobalSolutions X Spectre Ltd",
              "Technology processor (sweet1ne.com)",
              "Build and configure the Site; leads, VIP, forms and support, on Sweet1ne's instructions. They do not decide marketing audiences.",
            ],
            [
              "Vercel",
              "Website hosting",
              "Site traffic and hosting logs",
            ],
            [
              "Hetzner Online GmbH",
              "Server hosting (Germany)",
              "The server our booking and ordering system runs on, and its logs",
            ],
            [
              "Supabase",
              "Database and account hosting",
              "Bookings, orders, enquiries, mailing list and staff accounts",
            ],
            [
              "Resend (or then-current mailer)",
              "Processor",
              "Addresses and content of emails we send",
            ],
            [
              "SevenRooms",
              "Reservations, and card at booking",
              "Name, contact, party, date and time, branch, and the card for the guarantee",
            ],
            [
              "Toast",
              "Food, collection payment and kitchen",
              "Order, contact and payment on Toast's pages",
            ],
            [
              "Google",
              "reCAPTCHA; Maps if embedded; Analytics and Ads after consent",
              "Device and IP on forms; map loads; the tags you allowed",
            ],
            ["Meta", "Pixel after consent", "Events and identifiers you allowed"],
            ["Cookie banner provider", "Processor", "Your cookie choice"],
            ["Influx", "Marketing agency", "Only lists and pixels Sweet1ne instruct"],
            ["Advisers and law", "As required", "Minimum necessary"],
          ]}
        />

        <p className="text-[var(--ivory)]">We do not sell your information.</p>
      </Section>

      <Section number={9} title="International transfers">
        <p>
          Vercel, Google, Meta, SevenRooms, Toast and email hosting may process
          information outside the UK. We rely on adequacy, or the UK Addendum and
          International Data Transfer Agreement, plus a transfer assessment where
          required. Our server and database hosting are in the European Union.
        </p>

        <p>
          For the current list, email{" "}
          <a href="mailto:info@sweet1ne.com" className="text-[var(--gold)]">
            info@sweet1ne.com
          </a>
          .
        </p>
      </Section>

      <Section number={10} title="Retention">
        <Table
          headers={["Record", "Period"]}
          rows={[
            [
              "Unconverted leads and VIP who never engage",
              "Review after 12 months of inactivity",
            ],
            [
              "Booking, order or enquiry",
              "Normally 24 months after last interaction, longer if law requires",
            ],
            ["Published Google quotes we display", "While shown"],
            [
              "Marketing consent evidence",
              "For as long as needed to show permission",
            ],
            ["Suppression", "For as long as needed to honour opt-out"],
            ["Campaign events", "Normally 24 months, then aggregate or delete"],
            ["Analytics identifiers", "Shortest practical provider setting"],
            ["Security and admin logs", "Normally 12 months"],
            ["Support", "Normally 24 months after closure"],
            ["Backups", "Proposed maximum 90 days unless justified"],
          ]}
        />
      </Section>

      <Section number={11} title="Your rights">
        <p>
          Access; correction; deletion or restriction in certain cases; objection
          to legitimate interests; objection at any time to direct marketing
          (email, SMS and related profiling); withdrawal of consent; portability
          where the conditions apply; and complaint to the ICO at{" "}
          
          <a  href="https://ico.org.uk"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--gold)]"
          >
            ico.org.uk
          </a>
          .
        </p>

        <p>
          Email{" "}
          <a href="mailto:info@sweet1ne.com" className="text-[var(--gold)]">
            info@sweet1ne.com
          </a>
          . We may verify identity proportionately.
        </p>
      </Section>

      <Section number={12} title="Children">
        <p>
          This Site is not intended to build marketing profiles of children.
        </p>
      </Section>

      <Section number={13} title="Changes">
        <p>
          Version 0.9, effective 8 September 2026. We may update this notice; the
          version in the footer applies from its effective date.
        </p>
      </Section>
    </LegalPage>
  );
}