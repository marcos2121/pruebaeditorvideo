import { Nav } from "@/components/landing/Nav";
import { Hero, Marquee, HowItWorks, Scripts, Features, Presets, Pricing, FAQ, FinalCta, Footer } from "@/components/landing/Sections";

export default function Home() {
  return (
    <main className="relative">
      <Nav />
      <Hero />
      <Marquee />
      <HowItWorks />
      <Scripts />
      <Features />
      <Presets />
      <Pricing />
      <FAQ />
      <FinalCta />
      <Footer />
    </main>
  );
}
