"use client";

import { motion } from "framer-motion";

export type AgentAnim = "idle" | "thinking" | "working" | "talking" | "receiving";
export type AgentMood = "normal" | "sleepy" | "tired" | "motivated" | "stressed" | "creative";
export type AvatarAccessory =
  | "crown"
  | "glasses-clipboard"
  | "pen"
  | "beret"
  | "magnifier"
  | "books"
  | "chart"
  | "phone"
  | "laptop"
  | "binoculars"
  | "dashboard"
  | "none";

/**
 * Avatar pixel-art voxel estilo las referencias del usuario.
 * 12x12 grid, sin dependencias de imágenes.
 *
 * Combina DOS capas:
 *   - state  → qué está haciendo (idle/thinking/working/talking/receiving)
 *   - mood   → cómo se siente (sleepy/tired/motivated/stressed/creative/normal)
 *
 * Los overlays de mood (Zz, 💧 sudor, ⭐, ✨, ojos droopy) se dibujan encima
 * para darle personalidad sin tocar la animación de state.
 */
export default function PixelAvatar({
  color,
  colorDark,
  size = 64,
  state = "idle",
  mood = "normal",
  accessory = "none",
}: {
  color: string;
  colorDark: string;
  size?: number;
  state?: AgentAnim;
  mood?: AgentMood;
  accessory?: AvatarAccessory;
}) {
  const p = size / 12;

  // Cuerpo más gordito y redondeado que la versión anterior
  const body = [
    "000111111000",
    "001111111100",
    "011222222110",
    "012222222210",
    "012200022210",
    "012200022210",
    "012222222210",
    "011222222110",
    "011222222110",
    "001222222100",
    "001200002100",
    "001100001100",
  ];

  // Estados activos despiertan al agente (override sleepy/tired)
  const isActive = state === "working" || state === "receiving" || state === "talking";
  const eyesClosed = state === "thinking" || (mood === "sleepy" && !isActive);
  const mouthOpen = state === "talking" || state === "receiving";
  const eyesDroopy = mood === "tired" && !isActive;
  const eyesBig = mood === "motivated" || mood === "creative" || isActive;

  // Body tilt — estado de trabajo tiene prioridad sobre mood
  // para que un agente trabajando siempre "se vea trabajando".
  const bodyTilt =
    state === "working"
      ? { rotate: [-4, 4, -4], y: [0, -2, 0] }
      : state === "thinking"
        ? { y: [0, -3, 0] }
        : state === "receiving"
          ? { scale: [1, 1.08, 1] }
          : mood === "tired"
            ? { rotate: [-3, -5, -3] }
            : mood === "stressed"
              ? { x: [-0.8, 0.8, -0.8] }
              : mood === "motivated"
                ? { y: [0, -2, 0], rotate: [-1, 1, -1] }
                : mood === "creative"
                  ? { rotate: [-2, 2, -2] }
                  : undefined;

  const tiltDuration =
    state === "working"
      ? 0.35
      : state === "thinking"
        ? 0.7
        : state === "receiving"
          ? 0.6
          : mood === "tired"
            ? 2.5
            : mood === "stressed"
              ? 0.15
              : mood === "motivated"
                ? 0.5
                : 0.3;

  // viewBox extendido para que corona/accesorios laterales no se corten
  const vbPad = size * 0.25;
  const vbSize = size + vbPad * 2;

  return (
    <div style={{ position: "relative", width: size, height: size * 1.3 }}>
      {/* Mood overlays ABOVE the head */}
      {mood === "sleepy" && (
        <motion.div
          className="absolute pointer-events-none font-mono font-bold"
          style={{
            left: size * 0.7,
            top: -size * 0.15,
            fontSize: size * 0.3,
            color: "#93C5FD",
            textShadow: "0 0 4px rgba(147,197,253,0.8)",
          }}
          animate={{ y: [0, -6, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        >
          z
        </motion.div>
      )}
      {mood === "sleepy" && (
        <motion.div
          className="absolute pointer-events-none font-mono font-bold"
          style={{
            left: size * 0.8,
            top: -size * 0.3,
            fontSize: size * 0.4,
            color: "#93C5FD",
            textShadow: "0 0 4px rgba(147,197,253,0.8)",
          }}
          animate={{ y: [0, -8, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.7 }}
        >
          Z
        </motion.div>
      )}
      {mood === "stressed" && (
        <motion.div
          className="absolute pointer-events-none"
          style={{
            right: size * 0.08,
            top: size * 0.28,
            fontSize: size * 0.28,
          }}
          animate={{ opacity: [0, 1, 1, 0], y: [0, 2, 4, 6] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeIn" }}
        >
          💧
        </motion.div>
      )}
      {mood === "stressed" && (
        <motion.div
          className="absolute pointer-events-none"
          style={{
            left: -size * 0.15,
            top: -size * 0.1,
            fontSize: size * 0.25,
          }}
          animate={{ scale: [0, 1.2, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1.5 }}
        >
          💢
        </motion.div>
      )}
      {mood === "motivated" && (
        <>
          <motion.div
            className="absolute pointer-events-none"
            style={{ left: -size * 0.15, top: size * 0.1, fontSize: size * 0.25 }}
            animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4], rotate: [-20, 20, -20] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            ⭐
          </motion.div>
          <motion.div
            className="absolute pointer-events-none"
            style={{ right: -size * 0.1, top: size * 0.2, fontSize: size * 0.2 }}
            animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4], rotate: [20, -20, 20] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
          >
            ⭐
          </motion.div>
        </>
      )}
      {mood === "creative" && (
        <>
          <motion.div
            className="absolute pointer-events-none"
            style={{ left: size * 0.1, top: -size * 0.1, fontSize: size * 0.3 }}
            animate={{ scale: [0, 1.2, 0], rotate: [0, 180, 360] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            ✨
          </motion.div>
          <motion.div
            className="absolute pointer-events-none"
            style={{ right: size * 0.1, top: size * 0.1, fontSize: size * 0.25 }}
            animate={{ scale: [0, 1, 0], rotate: [0, -180, -360] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: 0.6 }}
          >
            ✨
          </motion.div>
          <motion.div
            className="absolute pointer-events-none"
            style={{ left: -size * 0.1, top: size * 0.25, fontSize: size * 0.22 }}
            animate={{ scale: [0, 1, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: 1 }}
          >
            🌈
          </motion.div>
        </>
      )}

      {/* SVG body */}
      <motion.svg
        width={vbSize}
        height={vbSize}
        viewBox={`${-vbPad} ${-vbPad} ${vbSize} ${vbSize}`}
        style={{
          imageRendering: "pixelated",
          display: "block",
          position: "absolute",
          left: -vbPad,
          top: -vbPad,
        }}
        animate={bodyTilt}
        transition={bodyTilt ? { duration: tiltDuration, repeat: Infinity, ease: "easeInOut" } : undefined}
      >
        {body.map((row, y) =>
          row.split("").map((c, x) => {
            if (c === "0") return null;
            const fill = c === "2" ? colorDark : color;
            return (
              <rect
                key={`${x}-${y}`}
                x={x * p}
                y={y * p}
                width={p + 0.5}
                height={p + 0.5}
                fill={fill}
              />
            );
          }),
        )}

        {/* Eyes */}
        {eyesClosed ? (
          <>
            <rect x={3 * p} y={5.6 * p} width={p * 1.5} height={p * 0.4} fill="#0A0A14" />
            <rect x={7.5 * p} y={5.6 * p} width={p * 1.5} height={p * 0.4} fill="#0A0A14" />
          </>
        ) : eyesDroopy ? (
          <>
            <rect x={3 * p} y={5.4 * p} width={p * 1.5} height={p * 1.1} fill="#0A0A14" />
            <rect x={7.5 * p} y={5.4 * p} width={p * 1.5} height={p * 1.1} fill="#0A0A14" />
            {/* droopy bag under eye */}
            <rect x={3 * p} y={6.4 * p} width={p * 1.5} height={p * 0.3} fill={colorDark} opacity={0.6} />
            <rect x={7.5 * p} y={6.4 * p} width={p * 1.5} height={p * 0.3} fill={colorDark} opacity={0.6} />
          </>
        ) : eyesBig ? (
          <>
            <rect x={2.8 * p} y={4.8 * p} width={p * 1.8} height={p * 1.8} fill="#0A0A14" />
            <rect x={7.4 * p} y={4.8 * p} width={p * 1.8} height={p * 1.8} fill="#0A0A14" />
            <rect x={3.2 * p} y={5 * p} width={p * 0.7} height={p * 0.7} fill="#ffffff" />
            <rect x={7.8 * p} y={5 * p} width={p * 0.7} height={p * 0.7} fill="#ffffff" />
            {mood === "creative" && (
              <>
                <rect x={3.6 * p} y={5.4 * p} width={p * 0.3} height={p * 0.3} fill="#FFB547" />
                <rect x={8.2 * p} y={5.4 * p} width={p * 0.3} height={p * 0.3} fill="#FFB547" />
              </>
            )}
          </>
        ) : (
          <>
            <rect x={3 * p} y={5 * p} width={p * 1.5} height={p * 1.5} fill="#0A0A14" />
            <rect x={7.5 * p} y={5 * p} width={p * 1.5} height={p * 1.5} fill="#0A0A14" />
          </>
        )}

        {/* Mouth */}
        {mood === "tired" || mood === "sleepy" ? (
          <rect x={5 * p} y={7.6 * p} width={p * 2} height={p * 0.3} fill="#0A0A14" />
        ) : mood === "stressed" ? (
          // wavy mouth
          <>
            <rect x={4.5 * p} y={7.4 * p} width={p * 0.6} height={p * 0.4} fill="#0A0A14" />
            <rect x={5.2 * p} y={7.7 * p} width={p * 0.6} height={p * 0.4} fill="#0A0A14" />
            <rect x={5.9 * p} y={7.4 * p} width={p * 0.6} height={p * 0.4} fill="#0A0A14" />
            <rect x={6.6 * p} y={7.7 * p} width={p * 0.6} height={p * 0.4} fill="#0A0A14" />
          </>
        ) : mood === "motivated" ? (
          // big smile
          <>
            <rect x={4 * p} y={7.2 * p} width={p * 4} height={p * 0.8} fill="#0A0A14" />
            <rect x={4 * p} y={7.2 * p} width={p * 0.4} height={p * 0.4} fill="#0A0A14" />
            <rect x={7.6 * p} y={7.2 * p} width={p * 0.4} height={p * 0.4} fill="#0A0A14" />
          </>
        ) : mouthOpen ? (
          <rect x={4.5 * p} y={7.2 * p} width={p * 3} height={p * 1} fill="#0A0A14" />
        ) : (
          <rect x={5 * p} y={7.5 * p} width={p * 2} height={p * 0.3} fill="#0A0A14" />
        )}

        {/* Cheek blush */}
        {mood !== "sleepy" && mood !== "tired" && (
          <>
            <rect x={2.2 * p} y={6.6 * p} width={p * 0.9} height={p * 0.5} fill="#FB7185" opacity={0.55} />
            <rect x={8.9 * p} y={6.6 * p} width={p * 0.9} height={p * 0.5} fill="#FB7185" opacity={0.55} />
          </>
        )}

        {/* Antenna — oculta cuando hay corona o boina */}
        {accessory !== "crown" && accessory !== "beret" && (
          <>
            <rect x={5.5 * p} y={0.2 * p} width={p} height={p * 0.8} fill={colorDark} />
            <motion.rect
              x={5.25 * p}
              y={-p * 0.2}
              width={p * 1.5}
              height={p * 0.8}
              fill={
                mood === "creative"
                  ? "#F0ABFC"
                  : mood === "motivated"
                    ? "#FFB547"
                    : state === "working"
                      ? "#FFB547"
                      : color
              }
              rx={p * 0.3}
              animate={
                state === "thinking" || state === "working" || mood === "creative" || mood === "motivated"
                  ? { opacity: [0.4, 1, 0.4] }
                  : undefined
              }
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          </>
        )}

        {/* Accesorios por rol */}
        <AccessoryLayer accessory={accessory} p={p} />
      </motion.svg>
    </div>
  );
}

function AccessoryLayer({ accessory, p }: { accessory: AvatarAccessory; p: number }) {
  switch (accessory) {
    case "crown":
      return (
        <g>
          {/* Base */}
          <rect x={3 * p} y={-0.2 * p} width={p * 6} height={p * 0.8} fill="#FFD700" />
          {/* Picos */}
          <rect x={3 * p} y={-1.3 * p} width={p * 0.9} height={p * 1.1} fill="#FFD700" />
          <rect x={4.5 * p} y={-1.6 * p} width={p * 0.9} height={p * 1.4} fill="#FFD700" />
          <rect x={6 * p} y={-1.9 * p} width={p * 0.9} height={p * 1.7} fill="#FFD700" />
          <rect x={7.5 * p} y={-1.3 * p} width={p * 0.9} height={p * 1.1} fill="#FFD700" />
          {/* Joya */}
          <rect x={6.2 * p} y={-1.5 * p} width={p * 0.5} height={p * 0.5} fill="#DC2626" />
        </g>
      );
    case "glasses-clipboard":
      return (
        <g>
          {/* Glasses — lentes cuadrados sobre los ojos */}
          <rect x={2.6 * p} y={4.6 * p} width={p * 2.2} height={p * 0.25} fill="#0A0A14" />
          <rect x={2.6 * p} y={4.6 * p} width={p * 0.25} height={p * 2.3} fill="#0A0A14" />
          <rect x={4.6 * p} y={4.6 * p} width={p * 0.25} height={p * 2.3} fill="#0A0A14" />
          <rect x={2.6 * p} y={6.7 * p} width={p * 2.2} height={p * 0.25} fill="#0A0A14" />
          <rect x={7.2 * p} y={4.6 * p} width={p * 2.2} height={p * 0.25} fill="#0A0A14" />
          <rect x={7.2 * p} y={4.6 * p} width={p * 0.25} height={p * 2.3} fill="#0A0A14" />
          <rect x={9.2 * p} y={4.6 * p} width={p * 0.25} height={p * 2.3} fill="#0A0A14" />
          <rect x={7.2 * p} y={6.7 * p} width={p * 2.2} height={p * 0.25} fill="#0A0A14" />
          {/* Puente */}
          <rect x={4.8 * p} y={5.5 * p} width={p * 2.4} height={p * 0.25} fill="#0A0A14" />
          {/* Clipboard pequeño al lado */}
          <rect x={-0.5 * p} y={6 * p} width={p * 2} height={p * 3} fill="#78350F" />
          <rect x={-0.3 * p} y={6.3 * p} width={p * 1.6} height={p * 2.5} fill="#FEF3C7" />
          <rect x={0 * p} y={6.8 * p} width={p * 1} height={p * 0.2} fill="#0A0A14" />
          <rect x={0 * p} y={7.3 * p} width={p * 1} height={p * 0.2} fill="#0A0A14" />
          <rect x={0 * p} y={7.8 * p} width={p * 0.7} height={p * 0.2} fill="#0A0A14" />
        </g>
      );
    case "pen":
      return (
        <g>
          {/* Plumín saliendo de la mano derecha */}
          <rect x={10.5 * p} y={6 * p} width={p * 0.4} height={p * 3} fill="#FCD34D" transform={`rotate(-25 ${10.7 * p} ${7.5 * p})`} />
          <rect x={10.2 * p} y={5.2 * p} width={p * 0.6} height={p * 0.8} fill="#0A0A14" transform={`rotate(-25 ${10.5 * p} ${5.6 * p})`} />
        </g>
      );
    case "beret":
      return (
        <g>
          {/* Boina inclinada */}
          <ellipse cx={6 * p} cy={0.8 * p} rx={p * 4.5} ry={p * 0.9} fill="#0A0A14" />
          <ellipse cx={5 * p} cy={0.2 * p} rx={p * 3.5} ry={p * 1.2} fill="#1E1B4B" />
          <circle cx={3 * p} cy={-0.4 * p} r={p * 0.5} fill="#DC2626" />
        </g>
      );
    case "magnifier":
      return (
        <g>
          {/* Lupa a la derecha */}
          <circle cx={11 * p} cy={6.5 * p} r={p * 1.8} fill="none" stroke="#FCD34D" strokeWidth={p * 0.4} />
          <circle cx={11 * p} cy={6.5 * p} r={p * 1.3} fill="#60A5FA" opacity={0.3} />
          <rect
            x={11.8 * p}
            y={7.8 * p}
            width={p * 0.5}
            height={p * 2.2}
            fill="#78350F"
            transform={`rotate(-45 ${12 * p} ${8.5 * p})`}
          />
        </g>
      );
    case "books":
      return (
        <g>
          {/* Pila de libros al lado derecho */}
          <rect x={10 * p} y={8 * p} width={p * 2.5} height={p * 0.6} fill="#DC2626" />
          <rect x={10 * p} y={8.6 * p} width={p * 2.5} height={p * 0.6} fill="#2563EB" />
          <rect x={10 * p} y={9.2 * p} width={p * 2.5} height={p * 0.6} fill="#059669" />
          <rect x={10.2 * p} y={8.1 * p} width={p * 2.1} height={p * 0.15} fill="#FEF3C7" />
          <rect x={10.2 * p} y={8.7 * p} width={p * 2.1} height={p * 0.15} fill="#FEF3C7" />
          <rect x={10.2 * p} y={9.3 * p} width={p * 2.1} height={p * 0.15} fill="#FEF3C7" />
        </g>
      );
    case "chart":
      return (
        <g>
          {/* Mini gráfico de barras creciendo */}
          <rect x={10.2 * p} y={8 * p} width={p * 0.5} height={p * 2} fill="#EF4444" />
          <rect x={10.9 * p} y={7 * p} width={p * 0.5} height={p * 3} fill="#F59E0B" />
          <rect x={11.6 * p} y={5.8 * p} width={p * 0.5} height={p * 4.2} fill="#10B981" />
          {/* Flecha arriba */}
          <rect x={12.2 * p} y={5 * p} width={p * 0.3} height={p * 0.3} fill="#10B981" />
        </g>
      );
    case "phone":
      return (
        <g>
          {/* Celular vertical */}
          <rect x={10 * p} y={6.5 * p} width={p * 1.8} height={p * 3.2} fill="#0A0A14" rx={p * 0.3} />
          <rect x={10.2 * p} y={6.8 * p} width={p * 1.4} height={p * 2.4} fill="#60A5FA" />
          {/* Corazón en la pantalla (social) */}
          <rect x={10.5 * p} y={7.2 * p} width={p * 0.25} height={p * 0.25} fill="#FB7185" />
          <rect x={10.9 * p} y={7.2 * p} width={p * 0.25} height={p * 0.25} fill="#FB7185" />
          <rect x={10.3 * p} y={7.5 * p} width={p * 0.8} height={p * 0.25} fill="#FB7185" />
          <rect x={10.5 * p} y={7.8 * p} width={p * 0.4} height={p * 0.25} fill="#FB7185" />
          {/* Botón home */}
          <rect x={10.7 * p} y={9.4 * p} width={p * 0.4} height={p * 0.2} fill="#374151" />
        </g>
      );
    case "laptop":
      return (
        <g>
          {/* Mini laptop */}
          <rect x={9.5 * p} y={7.5 * p} width={p * 3} height={p * 2} fill="#9CA3AF" rx={p * 0.15} />
          <rect x={9.7 * p} y={7.7 * p} width={p * 2.6} height={p * 1.6} fill="#0A0A14" />
          {/* Líneas de código verdes */}
          <rect x={10 * p} y={8 * p} width={p * 1.2} height={p * 0.2} fill="#10B981" />
          <rect x={10 * p} y={8.4 * p} width={p * 1.8} height={p * 0.2} fill="#34D399" />
          <rect x={10 * p} y={8.8 * p} width={p * 0.8} height={p * 0.2} fill="#10B981" />
          {/* Base del laptop */}
          <rect x={9.2 * p} y={9.5 * p} width={p * 3.6} height={p * 0.25} fill="#6B7280" />
        </g>
      );
    case "dashboard":
      return (
        <g>
          {/* Tablet horizontal con dashboard */}
          <rect x={9.2 * p} y={6 * p} width={p * 3.8} height={p * 3.2} fill="#0E7490" rx={p * 0.2} />
          <rect x={9.4 * p} y={6.2 * p} width={p * 3.4} height={p * 2.8} fill="#F0F9FF" rx={p * 0.1} />
          {/* Pie chart */}
          <circle cx={10.5 * p} cy={7.6 * p} r={p * 0.8} fill="#06B6D4" />
          <path
            d={`M ${10.5 * p} ${7.6 * p} L ${10.5 * p} ${6.8 * p} A ${p * 0.8} ${p * 0.8} 0 0 1 ${11.3 * p} ${7.6 * p} Z`}
            fill="#F59E0B"
          />
          <path
            d={`M ${10.5 * p} ${7.6 * p} L ${11.3 * p} ${7.6 * p} A ${p * 0.8} ${p * 0.8} 0 0 1 ${10.9 * p} ${8.35 * p} Z`}
            fill="#EF4444"
          />
          {/* Mini bar chart */}
          <rect x={11.7 * p} y={8.1 * p} width={p * 0.25} height={p * 0.6} fill="#06B6D4" />
          <rect x={12.05 * p} y={7.7 * p} width={p * 0.25} height={p * 1} fill="#06B6D4" />
          <rect x={12.4 * p} y={7.3 * p} width={p * 0.25} height={p * 1.4} fill="#06B6D4" />
          {/* Título simulado */}
          <rect x={11.7 * p} y={6.5 * p} width={p * 1.1} height={p * 0.15} fill="#0E7490" />
          <rect x={11.7 * p} y={6.9 * p} width={p * 0.8} height={p * 0.1} fill="#9CA3AF" />
        </g>
      );
    case "binoculars":
      return (
        <g>
          {/* Binoculares cubriendo los ojos */}
          <rect x={2.4 * p} y={4.5 * p} width={p * 3.2} height={p * 2.5} fill="#0A0A14" rx={p * 0.3} />
          <rect x={6.4 * p} y={4.5 * p} width={p * 3.2} height={p * 2.5} fill="#0A0A14" rx={p * 0.3} />
          <rect x={5.6 * p} y={5.3 * p} width={p * 0.8} height={p * 0.5} fill="#0A0A14" />
          {/* Lentes reflejo */}
          <circle cx={4 * p} cy={5.75 * p} r={p * 1.1} fill="#60A5FA" opacity={0.6} />
          <circle cx={8 * p} cy={5.75 * p} r={p * 1.1} fill="#60A5FA" opacity={0.6} />
          <circle cx={3.7 * p} cy={5.5 * p} r={p * 0.4} fill="#FEF3C7" opacity={0.8} />
          <circle cx={7.7 * p} cy={5.5 * p} r={p * 0.4} fill="#FEF3C7" opacity={0.8} />
        </g>
      );
    case "none":
    default:
      return null;
  }
}
