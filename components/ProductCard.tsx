"use client";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useState } from "react";
import type { Product } from "@/lib/products";

interface ProductCardProps {
  product: Product;
  imageUrl?: string;
}

export default function ProductCard({ product, imageUrl }: ProductCardProps) {
  const [liked, setLiked] = useState(false);
  const [imgError, setImgError] = useState(false);
  const minPrice = Math.min(...product.pricing.map(p => p.price));

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="relative bg-white rounded-2xl overflow-hidden group"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "1px solid #F0F0F0" }}
    >
      {/* Badge */}
      {product.badge && (
        <div className="absolute top-3 left-3 z-10 px-2.5 py-1 text-xs font-bold text-white rounded-full"
          style={{ background: "var(--primary)" }}>
          {product.badge}
        </div>
      )}
      {product.isNew && !product.badge && (
        <div className="absolute top-3 left-3 z-10 px-2.5 py-1 text-xs font-bold rounded-full"
          style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
          Nuevo
        </div>
      )}

      {/* Wishlist */}
      <button
        onClick={() => setLiked(!liked)}
        className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm transition-transform active:scale-90 cursor-pointer"
      >
        <svg width="16" height="16" viewBox="0 0 24 24"
          fill={liked ? "var(--primary)" : "none"}
          stroke={liked ? "var(--primary)" : "#999"}
          strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>

      {/* Image */}
      <Link href={`/laptops/${product.slug}`}>
        <div className="aspect-[4/3] bg-[#F5F5F7] flex items-center justify-center overflow-hidden group-hover:bg-[#EBEBED] transition-colors">
          {imageUrl && !imgError ? (
            <Image
              src={imageUrl}
              alt={product.name}
              width={600}
              height={385}
              className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
              onError={() => setImgError(true)}
              priority={false}
            />
          ) : (
            <div className="text-center p-6">
              <div className="text-7xl mb-2">💻</div>
              <div className="text-xs font-semibold text-gray-400">{product.chip} · {product.ram}</div>
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="p-4">
        <Link href={`/laptops/${product.slug}`}>
          <h3 className="font-bold text-sm leading-snug mb-3" style={{ color: "var(--dark-text)" }}>
            {product.name}
          </h3>
        </Link>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs mb-0.5" style={{ color: "var(--light-text)" }}>desde</p>
            <p className="text-2xl font-black" style={{ color: "var(--dark-text)" }}>
              ${minPrice}
              <span className="text-sm font-semibold ml-1" style={{ color: "var(--medium-text)" }}>/mes</span>
            </p>
          </div>
          <Link
            href={`/laptops/${product.slug}`}
            className="px-4 py-2 text-sm font-bold text-white rounded-full transition-all hover:opacity-90 active:scale-95"
            style={{ background: "var(--primary)" }}
          >
            Ver planes
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
