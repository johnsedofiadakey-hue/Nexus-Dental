import HeroSection from "@/components/home/HeroSection";
import TrustSection from "@/components/home/TrustSection";
import ServicesSection from "@/components/home/ServicesSection";
import ConsultationSection from "@/components/home/ConsultationSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import InsuranceSection from "@/components/home/InsuranceSection";
import CTASection from "@/components/home/CTASection";
import SmileJourneySection from "@/components/home/SmileJourneySection";

export default function Home() {
  return (
    <>
      <HeroSection />
      <TrustSection />
      <SmileJourneySection />
      <ServicesSection />
      <ConsultationSection />
      <TestimonialsSection />
      <InsuranceSection />
      <CTASection />
    </>
  );
}
