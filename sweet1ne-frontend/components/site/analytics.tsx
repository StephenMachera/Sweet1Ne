"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { getStoredConsent } from "./cookie-consent";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/**
 * Loads Google Tag Manager and the Meta Pixel — but only once someone has
 * accepted. Both set cookies the moment they run, so loading them first and
 * asking afterwards would already be too late.
 *
 * Listens for the consent event rather than requiring a reload, so accepting
 * starts tracking immediately.
 */
export function Analytics() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    setConsented(getStoredConsent() === "accepted");

    const onConsent = (e: Event) => {
      setConsented((e as CustomEvent).detail === "accepted");
    };

    window.addEventListener("sweet1ne:consent", onConsent);
    return () => window.removeEventListener("sweet1ne:consent", onConsent);
  }, []);

  if (!consented) return null;

  return (
    <>
      {GTM_ID && (
        <>
          <Script id="gtm" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
          </Script>

          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        </>
      )}

      {META_PIXEL_ID && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`}
          </Script>

          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              alt=""
              src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}
    </>
  );
}

/**
 * Fires a conversion event to both platforms.
 *
 * Called from the reservation form's success handler — this is what the ads
 * actually optimise for. Safe to call whether or not anything loaded: the
 * optional chaining means it quietly does nothing without consent.
 */
export function trackConversion(
  event: "Lead" | "Contact" | "CompleteRegistration" | "Purchase" | "AddToCart",
  data?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;

  (window as any).fbq?.("track", event, data);

  // GTM picks this up from the dataLayer — they wire it to whatever Google
  // Ads conversion they've configured, without needing a code change.
  (window as any).dataLayer?.push({
    event: `sweet1ne_${event.toLowerCase()}`,
    ...data,
  });
}