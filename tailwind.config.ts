import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: "#061111",
          900: "#071817",
          800: "#0b2323",
          700: "#103131",
        },
        electric: {
          cyan: "#22d3ee",
          blue: "#38bdf8",
          green: "#22c55e",
          violet: "#a78bfa",
        },
      },
      boxShadow: {
        panel: "0 18px 60px rgba(0, 0, 0, 0.35)",
        glow: "0 0 0 1px rgba(34, 211, 238, 0.25), 0 18px 70px rgba(34, 211, 238, 0.12)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
