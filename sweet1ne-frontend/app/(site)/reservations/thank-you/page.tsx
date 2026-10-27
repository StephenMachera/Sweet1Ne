import type { Metadata } from "next";
import { CurtainShell } from "@/components/site/thank-you/curtain-shell";
import { ThankYouHero } from "@/components/site/thank-you/thank-you-hero";
import { ThankYouFooter } from "@/components/site/thank-you/thank-you-footer";


export const metadata: Metadata = {
  title: "Thank you | Sweet1NE",
  robots: { index: false, follow: false },
};

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>;
}) {
  const { src } = await searchParams;
  const source = src === "website" ? "website" : "sevenrooms";

  return (
    <CurtainShell footer={<ThankYouFooter />}>
      <ThankYouHero source={source} />
    </CurtainShell>
  );
}