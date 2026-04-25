import GrainOverlay from "./components/GrainOverlay";
import Navbar from "./components/Navbar";
import HeroSection from "./components/HeroSection";
import ScienceStrip from "./components/ScienceStrip";
import ProductSection from "./components/ProductSection";
import AIAgentSection from "./components/AIAgentSection";
import KOLQuotes from "./components/KOLQuotes";
import ManifestoSection from "./components/ManifestoSection";
import PipelineSection from "./components/PipelineSection";
import Footer from "./components/Footer";
import CustomCursor from "./components/CustomCursor";

export default function Home() {
  return (
    <>
      <GrainOverlay />
      <CustomCursor />
      <Navbar />
      <main>
        <HeroSection />
        <ScienceStrip />
        <ProductSection />
        <AIAgentSection />
        <KOLQuotes />
        <ManifestoSection />
        <PipelineSection />
      </main>
      <Footer />
    </>
  );
}
