import Link from "next/link";
import { ConversionTracker } from "./conversion-tracker";
const styles = {
  root: "ty-root", inner: "ty-inner", display: "ty-display",
  veil: "ty-veil", lights: "ty-lights", embers: "ty-embers",
  bokeh: "ty-bokeh", ember: "ty-ember",
  tick: "ty-tick", tLine: "ty-tline", tFill: "ty-tfill",
  tRing: "ty-tring", tCheck: "ty-tcheck", tPulse: "ty-tpulse",
  title: "ty-title", mask: "ty-mask", body: "ty-body",
  actions: "ty-actions", btn: "ty-btn",
  btnPrimary: "ty-btn-primary", btnGhost: "ty-btn-ghost",
  b1: "ty-b1", b2: "ty-b2", arr: "ty-arr",
};

type Source = "sevenrooms" | "website";

const COPY: Record<Source, { heading: string; body: string }> = {
  sevenrooms: {
    heading: "Thank you!",
    body: "Your reservation is in. You\u2019ll receive a confirmation at the email address you booked with. We look forward to hosting you.",
  },
  website: {
    heading: "We\u2019ve got it!",
    body: "Your request has been sent. You\u2019ll get an email from us in a moment, and our team will confirm your reservation by email.",
  },
};

export function ThankYouHero({ source = "sevenrooms" }: { source?: Source }) {
  const copy = COPY[source];

  return (
    <section className={styles.root} aria-labelledby="thank-you-title">
      <ConversionTracker source={source} />

      <div className={styles.lights} aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={styles.bokeh} />
        ))}
      </div>
      <div className={styles.veil} aria-hidden="true" />
      <div className={styles.embers} aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className={styles.ember} />
        ))}
      </div>

      <div className={styles.inner}>
        <svg
          className={styles.tick}
          viewBox="0 0 160 160"
          width="156"
          height="156"
          aria-hidden="true"
          focusable="false"
        >
          <circle className={`${styles.tPulse} ${styles.tLine}`} cx="80" cy="80" r="64" strokeWidth="1" />
          <circle className={styles.tFill} cx="80" cy="80" r="64" style={{ fill: "#1c1b1b" }} />
          <circle className={`${styles.tRing} ${styles.tLine}`} cx="80" cy="80" r="64" strokeWidth="2" transform="rotate(-90 80 80)" />
          <path className={`${styles.tCheck} ${styles.tLine}`} d="M50 82 L72 104 L112 58" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <h1 id="thank-you-title" className={`${styles.display} ${styles.title}`}>
          <span className={styles.mask}>
            <span>{copy.heading}</span>
          </span>
        </h1>

        <p className={styles.body}>{copy.body}</p>

        <div className={styles.actions}>
          <Link href="/" className={`${styles.btn} ${styles.btnPrimary} ${styles.b1}`}>
            <svg className={styles.arr} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 12H4M10 6l-6 6 6 6" />
            </svg>
            <span>Back home</span>
          </Link>
          <Link href="/menu" className={`${styles.btn} ${styles.btnGhost} ${styles.b2}`}>
            <span>Menu</span>
            <svg className={styles.arr} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 12h16M14 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}