import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { CompareProvider } from "@/components/CompareBar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompareProvider>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
    </CompareProvider>
  );
}
