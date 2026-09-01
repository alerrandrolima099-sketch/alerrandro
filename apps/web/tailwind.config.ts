import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#0b0f14",
        surface: "#121821",
        surfaceHover: "#1a2230",
        border: "#232c3a",
        primary: "#22c55e",
        primaryDark: "#16a34a",
        muted: "#8b98a9",
      },
    },
  },
  plugins: [],
};
export default config;
