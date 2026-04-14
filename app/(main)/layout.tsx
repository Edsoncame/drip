import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import CookieConsent from "@/components/CookieConsent";
import { CompareProvider } from "@/components/CompareBar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompareProvider>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
      <CookieConsent />
    </CompareProvider>
  );
}
