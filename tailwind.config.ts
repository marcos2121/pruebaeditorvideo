import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#06060b", 900: "#0b0b14", 800: "#12121f", 700: "#1a1a2b", 600: "#262639" },
        volt: { 300: "#c8ff6b", 400: "#b4ff3b", 500: "#9dff00" },
        flame: { 400: "#ff6a3d", 500: "#ff4d1c" },
        violet: { 400: "#9d7bff", 500: "#7c5cff" },
      },
      fontFamily: {
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 60px -10px rgba(157,255,0,0.45)",
        "glow-violet": "0 0 80px -20px rgba(124,92,255,0.6)",
        card: "0 20px 60px -20px rgba(0,0,0,0.7)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        marquee: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 3s linear infinite",
        marquee: "marquee 30s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
