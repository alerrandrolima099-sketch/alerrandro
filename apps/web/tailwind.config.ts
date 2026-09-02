import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Paleta "escuro premium" (seção 37 - modernização visual): a base
        // continua escura, mas com um leve tom azulado (em vez de um cinza
        // neutro) e o verde de marca ganha companhia de um acento
        // violeta/índigo usado em gradientes e detalhes, pra dar uma cara
        // mais "produto SaaS moderno" sem perder a identidade original.
        background: "#0a0d13",
        surface: "#12161f",
        surfaceHover: "#1a1f2c",
        surface2: "#171c27", // um degrau acima do surface, para cards dentro de cards
        border: "#232a3a",
        borderLight: "rgba(255,255,255,0.08)",
        primary: "#22c55e",
        primaryDark: "#16a34a",
        primaryLight: "#4ade80",
        accent: "#818cf8", // índigo - usado em gradientes e detalhes de destaque
        accentLight: "#a5b4fc",
        muted: "#8b98a9",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(34,197,94,0.15), 0 8px 24px -8px rgba(34,197,94,0.35)",
        card: "0 1px 2px rgba(0,0,0,0.4), 0 12px 32px -16px rgba(0,0,0,0.6)",
        soft: "0 1px 2px rgba(0,0,0,0.3)",
      },
      backgroundImage: {
        "mesh-premium":
          "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(34,197,94,0.18), transparent), radial-gradient(ellipse 60% 50% at 100% 0%, rgba(129,140,248,0.14), transparent)",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        blob: {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(20px, -30px) scale(1.05)" },
          "66%": { transform: "translate(-15px, 15px) scale(0.97)" },
        },
      },
      animation: {
        "fade-in-up": "fadeInUp 0.5s ease-out both",
        blob: "blob 14s infinite ease-in-out",
      },
    },
  },
  plugins: [],
};
export default config;
