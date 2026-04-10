import Link from "next/link";

export default function ContactoPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm text-[#1B4FFF] hover:underline">← Volver al inicio</Link>
      </div>

      <h1 className="text-3xl font-800 text-[#18191F] mb-2">Contacto</h1>
      <p className="text-[#666666] mb-10">¿Tienes preguntas? Estamos aquí para ayudarte.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        {[
          {
            icon: "📧",
            title: "Correo general",
            value: "hola@flux.pe",
            href: "mailto:hola@flux.pe",
            desc: "Respuesta en menos de 24h hábiles",
          },
          {
            icon: "💬",
            title: "WhatsApp",
            value: "+51 999 000 000",
            href: "https://wa.me/51999000000",
            desc: "Lunes a viernes, 9am – 6pm",
          },
          {
            icon: "🏢",
            title: "Ventas corporativas",
            value: "ventas@flux.pe",
            href: "mailto:ventas@flux.pe",
            desc: "Para flotas de 5+ equipos",
          },
          {
            icon: "🔒",
            title: "Privacidad y datos",
            value: "privacidad@flux.pe",
            href: "mailto:privacidad@flux.pe",
            desc: "Ejercicio de derechos ARCO",
          },
        ].map(item => (
          <a key={item.title} href={item.href}
            className="bg-white border border-[#E5E5E5] rounded-2xl p-6 hover:border-[#1B4FFF] hover:shadow-sm transition-all group block">
            <div className="text-3xl mb-3">{item.icon}</div>
            <p className="font-700 text-[#18191F] mb-1 group-hover:text-[#1B4FFF] transition-colors">{item.title}</p>
            <p className="text-[#1B4FFF] font-600 text-sm mb-1">{item.value}</p>
            <p className="text-xs text-[#999999]">{item.desc}</p>
          </a>
        ))}
      </div>

      <div className="bg-[#F7F7F7] rounded-2xl p-6">
        <h2 className="font-700 text-[#18191F] mb-2">Oficina</h2>
        <p className="text-sm text-[#666666]">Tika Services S.A.C.</p>
        <p className="text-sm text-[#666666]">Lima, Perú</p>
        <p className="text-sm text-[#666666] mt-1">RUC: 20608888888</p>
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-[#666666] mb-4">¿Listo para empezar?</p>
        <Link href="/laptops"
          className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#1B4FFF] text-white font-700 rounded-full hover:bg-[#1340CC] transition-colors">
          Ver MacBooks disponibles
        </Link>
      </div>
    </div>
  );
}
