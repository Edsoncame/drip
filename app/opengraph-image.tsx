import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "FLUX — Alquiler de MacBook en Lima, Perú";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #1B4FFF 0%, #102F99 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "white",
            letterSpacing: "-0.03em",
            marginBottom: 16,
          }}
        >
          flux
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 600,
            color: "rgba(255,255,255,0.9)",
            marginBottom: 40,
          }}
        >
          Tu Mac. Sin comprarla.
        </div>
        <div
          style={{
            display: "flex",
            gap: 32,
            alignItems: "center",
          }}
        >
          {[
            "MacBook Air M4 — $85/mes",
            "MacBook Pro M4 — $110/mes",
            "MacBook Pro M5 — $120/mes",
          ].map((text) => (
            <div
              key={text}
              style={{
                background: "rgba(255,255,255,0.15)",
                borderRadius: 16,
                padding: "12px 24px",
                fontSize: 18,
                fontWeight: 600,
                color: "white",
              }}
            >
              {text}
            </div>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 40,
            fontSize: 18,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          fluxperu.com · Alquiler de MacBook en Lima · Entrega en 24-48h
        </div>
      </div>
    ),
    { ...size }
  );
}
