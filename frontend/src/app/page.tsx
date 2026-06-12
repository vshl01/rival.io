import { SmoothScroll } from '@/components/motion/smooth-scroll';
import { FeatureBento } from '@/components/landing/feature-bento';
import { FinalCta } from '@/components/landing/final-cta';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Marquee } from '@/components/landing/marquee';
import { SiteFooter } from '@/components/landing/site-footer';
import { SiteHeader } from '@/components/landing/site-header';

export default function LandingPage() {
  return (
    <SmoothScroll>
      <SiteHeader />
      <main>
        <Hero />
        <Marquee />
        <FeatureBento />
        <HowItWorks />
        <FinalCta />
      </main>
      <SiteFooter />
    </SmoothScroll>
  );
}
