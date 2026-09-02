import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#0b0f14",
        surface: "#121821",
        surfaceElevated: "#171f2a",
        surfaceHover: "#1a2230",
        border: "#232c3a",
        borderSubtle: "#1b232f",
        primary: "#22c55e",
        primaryDark: "#16a34a",
        muted: "#8b98a9",
        fire: {
          DEFAULT: "#f97316",
          light: "#fb923c",
          dark: "#c2410c",
        },
        success: {
          DEFAULT: "#22c55e",
          light: "#4ade80",
          dark: "#15803d",
        },
        warning: {
          DEFAULT: "#eab308",
          light: "#facc15",
          dark: "#a16207",
        },
        danger: {
          DEFAULT: "#ef4444",
          light: "#f87171",
          dark: "#b91c1c",
        },
        info: {
          DEFAULT: "#3b82f6",
          light: "#60a5fa",
          dark: "#1d4ed8",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.3)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
        "slide-up": "slide-up 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
