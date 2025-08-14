import FooterSection from "@/components/homepage/footer";
import HeroSection from "@/components/homepage/hero-section";
import Integrations from "@/components/homepage/integrations";
import PropertyShowcase from "@/components/homepage/property-showcase";

export default function Home() {
  return (
    <>
      <HeroSection />
      <Integrations />
      <PropertyShowcase />
      <FooterSection />
    </>
  );
}
