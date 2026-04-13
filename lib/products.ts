export interface Product {
  slug: string;
  name: string;
  shortName: string;
  chip: string;
  ram: string;
  ssd: string;
  color: string;
  image: string;
  badge?: string;
  isNew?: boolean;
  stock: number; // 0 = agotado, 1-3 = últimas unidades, 4+ = disponible
  pricing: {
    months: number;
    price: number;
  }[];
  specs: { label: string; value: string }[];
  includes: string[];
}

export const products: Product[] = [
  {
    slug: "macbook-air-13-m4",
    name: "MacBook Air 13\" — Apple M4",
    shortName: "MacBook Air 13\"",
    chip: "Apple M4",
    ram: "16 GB",
    ssd: "256 GB SSD",
    color: "Gris Espacial",
    image: "/images/macbook-air-13.png",
    isNew: true,
    stock: 5,
    pricing: [
      { months: 8,  price: 115 },
      { months: 16, price: 95  },
      { months: 24, price: 85  },
    ],
    specs: [
      { label: "Chip",    value: "Apple M4" },
      { label: "CPU",     value: "8 núcleos" },
      { label: "GPU",     value: "8 núcleos" },
      { label: "RAM",     value: "16 GB" },
      { label: "SSD",     value: "256 GB" },
      { label: "Pantalla",value: "13.6\" Liquid Retina" },
      { label: "Batería", value: "Hasta 18 horas" },
      { label: "Peso",    value: "1.24 kg" },
    ],
    includes: ["Cable USB-C", "Adaptador de corriente 30W", "Guía de inicio rápido"],
  },
  {
    slug: "macbook-pro-14-m4",
    name: "MacBook Pro 14\" — Apple M4",
    shortName: "MacBook Pro 14\"",
    chip: "Apple M4",
    ram: "16 GB",
    ssd: "512 GB SSD",
    color: "Plata",
    image: "/images/macbook-pro-14-m4.png",
    stock: 3,
    pricing: [
      { months: 8,  price: 165 },
      { months: 16, price: 130 },
      { months: 24, price: 110 },
    ],
    specs: [
      { label: "Chip",    value: "Apple M4" },
      { label: "CPU",     value: "10 núcleos" },
      { label: "GPU",     value: "10 núcleos" },
      { label: "RAM",     value: "16 GB" },
      { label: "SSD",     value: "512 GB" },
      { label: "Pantalla",value: "14.2\" Liquid Retina XDR" },
      { label: "Batería", value: "Hasta 24 horas" },
      { label: "Peso",    value: "1.60 kg" },
    ],
    includes: ["Cable USB-C a MagSafe 3", "Adaptador de corriente 70W", "Guía de inicio rápido"],
  },
  {
    slug: "macbook-pro-14-m5",
    name: "MacBook Pro 14\" — Apple M5",
    shortName: "MacBook Pro 14\" M5",
    chip: "Apple M5",
    ram: "16 GB",
    ssd: "256 GB SSD",
    color: "Negro Sideral",
    image: "/images/macbook-pro-14-m5.png",
    badge: "Nuevo 2025",
    isNew: true,
    stock: 2,
    pricing: [
      { months: 8,  price: 175 },
      { months: 16, price: 140 },
      { months: 24, price: 125 },
    ],
    specs: [
      { label: "Chip",    value: "Apple M5" },
      { label: "CPU",     value: "10 núcleos" },
      { label: "GPU",     value: "14 núcleos" },
      { label: "RAM",     value: "16 GB" },
      { label: "SSD",     value: "256 GB" },
      { label: "Pantalla",value: "14.2\" Liquid Retina XDR" },
      { label: "Batería", value: "Hasta 24 horas" },
      { label: "Peso",    value: "1.60 kg" },
    ],
    includes: ["Cable USB-C a MagSafe 3", "Adaptador de corriente 70W", "Guía de inicio rápido"],
  },
];

export function getProduct(slug: string) {
  return products.find(p => p.slug === slug);
}
