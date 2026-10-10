import React from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * AIOrb — Siri / Apple Intelligence / Gemini style rotating 3D energy orb.
 *
 * @param {string} state - "idle" | "listening" | "thinking" | "speaking" | "reveal" | "error"
 * @param {string} size - "sm" (100px) | "md" (160px) | "lg" (220px) | "xl" (280px)
 * @param {boolean} interactive - whether clicking triggers callback
 * @param {function} onClick - click handler
 * @param {string} label - optional status text below the orb
 */
export default function AIOrb({
  state = "idle",
  size = "md",
  interactive = false,
  onClick,
  label,
}) {
  const sizeMap = {
    sm: "w-24 h-24",
    md: "w-40 h-40 md:w-48 md:h-48",
    lg: "w-52 h-52 md:w-60 md:h-60",
    xl: "w-64 h-64 md:w-72 md:h-72",
  };

  const orbSizeClass = sizeMap[size] || sizeMap.md;

  // Color theme gradients based on current state
  const isListening = state === "listening";
  const isThinking = state === "thinking" || state === "loading";
  const isSpeaking = state === "speaking" || state === "asking";
  const isReveal = state === "reveal" || state === "done";
  const isError = state === "error";

  // Aura colors
  const auraGradients = isError
    ? "from-red-500/30 via-rose-500/20 to-transparent"
    : isReveal
    ? "from-emerald-400/40 via-teal-500/25 to-transparent"
    : isListening
    ? "from-fuchsia-500/40 via-cyan-400/30 to-transparent"
    : isThinking
    ? "from-indigo-500/40 via-purple-500/30 to-transparent"
    : "from-blue-500/35 via-violet-500/25 to-transparent";

  return (
    <div className="relative flex flex-col items-center justify-center select-none py-2">
      {/* ── Acoustic Ripple Rings (when listening or speaking) ── */}
      <AnimatePresence>
        {(isListening || isSpeaking) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span
              className={`absolute w-full h-full rounded-full border border-cyan-400/30 animate-orb-ripple`}
              style={{ animationDuration: isListening ? "1.6s" : "2.4s" }}
            />
            <span
              className={`absolute w-full h-full rounded-full border border-fuchsia-400/20 animate-orb-ripple`}
              style={{
                animationDuration: isListening ? "1.6s" : "2.4s",
                animationDelay: "0.8s",
              }}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Ambient Outer Glow ── */}
      <div
        className={`absolute rounded-full blur-3xl transition-all duration-700 pointer-events-none ${
          size === "sm" ? "w-36 h-36" : size === "lg" ? "w-80 h-80" : "w-64 h-64"
        } bg-gradient-to-r ${auraGradients} ${
          isThinking ? "animate-orb-spin-fast scale-110" : "animate-orb-glow"
        }`}
      />

      {/* ── Main Orb Container ── */}
      <motion.div
        whileHover={interactive ? { scale: 1.04 } : {}}
        whileTap={interactive ? { scale: 0.96 } : {}}
        onClick={interactive ? onClick : undefined}
        className={`relative ${orbSizeClass} rounded-full cursor-${
          interactive ? "pointer" : "default"
        } flex items-center justify-center`}
      >
        {/* Outer glass rim highlight */}
        <div className="absolute inset-0 rounded-full p-[2px] bg-gradient-to-b from-white/60 via-white/10 to-white/5 pointer-events-none z-20 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]" />

        {/* Orb sphere shell with backdrop blur */}
        <div className="relative w-full h-full rounded-full overflow-hidden bg-slate-950/80 backdrop-blur-md shadow-2xl flex items-center justify-center">
          
          {/* Layer 1: Primary Rotating Iridescent Conic Mesh */}
          <div
            className={`absolute -inset-[35%] rounded-full opacity-80 mix-blend-screen filter blur-md ${
              isThinking
                ? "animate-orb-spin-fast"
                : "animate-orb-spin-cw"
            }`}
            style={{
              background: isError
                ? "conic-gradient(from 0deg, #ef4444, #f43f5e, #dc2626, #fb7185, #ef4444)"
                : isReveal
                ? "conic-gradient(from 0deg, #10b981, #06b6d4, #34d399, #6ee7b7, #10b981)"
                : isListening
                ? "conic-gradient(from 0deg, #ec4899, #06b6d4, #8b5cf6, #f43f5e, #ec4899)"
                : isThinking
                ? "conic-gradient(from 0deg, #6366f1, #a855f7, #3b82f6, #06b6d4, #6366f1)"
                : "conic-gradient(from 0deg, #3b82f6, #8b5cf6, #06b6d4, #6366f1, #3b82f6)",
            }}
          />

          {/* Layer 2: Counter-Rotating Fluid Organic Blob (mix-blend overlay) */}
          <div
            className={`absolute -inset-[20%] opacity-75 mix-blend-color-dodge filter blur-lg ${
              isThinking
                ? "animate-orb-spin-ccw animate-orb-wobble"
                : "animate-orb-spin-ccw animate-orb-wobble"
            }`}
            style={{
              background: isReveal
                ? "radial-gradient(circle at 40% 40%, #34d399 0%, #059669 45%, #047857 75%, transparent 100%)"
                : isListening
                ? "radial-gradient(circle at 40% 40%, #06b6d4 0%, #ec4899 45%, #9333ea 75%, transparent 100%)"
                : "radial-gradient(circle at 35% 35%, #38bdf8 0%, #6366f1 50%, #4338ca 80%, transparent 100%)",
            }}
          />

          {/* Layer 3: Central High-Energy Core */}
          <div
            className={`absolute w-1/2 h-1/2 rounded-full mix-blend-screen filter blur-sm transition-transform duration-500 ${
              isListening
                ? "scale-125 bg-gradient-to-r from-pink-300 to-cyan-200 animate-pulse"
                : isThinking
                ? "scale-110 bg-gradient-to-r from-violet-200 to-indigo-300 animate-ping"
                : "scale-100 bg-gradient-to-r from-blue-200 via-indigo-100 to-cyan-200 opacity-90 animate-pulse"
            }`}
          />

          {/* Layer 4: Modern Audio Wave Equalizer (visible during listening/speaking) */}
          {isListening && (
            <div className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-1 z-10">
              {[0.4, 0.9, 0.6, 1, 0.7, 0.3].map((heightMul, i) => (
                <motion.div
                  key={i}
                  animate={{
                    height: ["8px", `${22 * heightMul}px`, "8px"],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 0.6 + i * 0.1,
                    ease: "easeInOut",
                  }}
                  className="w-1 bg-white/90 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                />
              ))}
            </div>
          )}

          {/* Layer 5: Realistic Glass Specular Arc Reflection */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none z-10"
            style={{
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 25%, rgba(255,255,255,0) 60%)",
            }}
          />

          {/* Subtle inner shadow for 3D sphere depth */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none z-10"
            style={{
              boxShadow:
                "inset 0 -12px 24px rgba(0,0,0,0.6), inset 0 2px 6px rgba(255,255,255,0.4)",
            }}
          />
        </div>
      </motion.div>

      {/* ── Status Label Pill ── */}
      {label && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 px-3 py-1 rounded-full bg-slate-900/60 backdrop-blur-md border border-slate-700/50 text-slate-300 text-xs font-medium flex items-center gap-2 shadow-sm"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isError
                ? "bg-red-400"
                : isListening
                ? "bg-fuchsia-400 animate-ping"
                : isThinking
                ? "bg-cyan-400 animate-spin"
                : isReveal
                ? "bg-emerald-400"
                : "bg-blue-400 animate-pulse"
            }`}
          />
          <span>{label}</span>
        </motion.div>
      )}
    </div>
  );
}
