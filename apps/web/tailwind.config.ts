import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Paleta "roxo escuro premium" (seção 40 - redesign de identidade
        // visual): o sistema deixa de usar o tema preto/azulado com verde de
        // marca e passa a usar uma base roxo bem escura, quase preta, com um
        // roxo vibrante como cor de marca/ação - sem gradientes chamativos
        // ou tons neon, para manter a leitura confortável e uma cara "SaaS
        // premium". A sidebar ganha um tom próprio (levemente mais escuro
        // que os cards), conforme pedido.
        background: "#0F0C1D",
        sidebar: "#121025",
        surface: "#1A1633",
        surfaceHover: "#251F47",
        surface2: "#211B3D", // um degrau acima do surface, para cards dentro de cards e inputs
        border: "#2D2748",
        borderLight: "rgba(255,255,255,0.08)",
        primary: "#8B5CF6",
        primaryDark: "#7C3AED",
        primaryLight: "#A78BFA",
        accent: "#A78BFA", // roxo claro - usado em detalhes de destaque e gradientes sutis
        accentLight: "#C4B5FD",
        muted: "#A9A3C2",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(139,92,246,0.15), 0 8px 24px -8px rgba(139,92,246,0.35)",
        card: "0 1px 2px rgba(0,0,0,0.4), 0 12px 32px -16px rgba(0,0,0,0.6)",
        soft: "0 1px 2px rgba(0,0,0,0.3)",
      },
      backgroundImage: {
        "mesh-premium":
          "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(139,92,246,0.14), transparent), radial-gradient(ellipse 60% 50% at 100% 0%, rgba(167,139,250,0.10), transparent)",
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
