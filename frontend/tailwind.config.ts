import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontSize: {
        "fluid-xs": ["clamp(0.75rem, 0.72rem + 0.15vw, 0.8125rem)", { lineHeight: "1.4" }],
        "fluid-sm": ["clamp(0.8125rem, 0.78rem + 0.2vw, 0.875rem)", { lineHeight: "1.45" }],
        "fluid-base": ["clamp(0.875rem, 0.82rem + 0.35vw, 1rem)", { lineHeight: "1.5" }],
        "fluid-lg": ["clamp(1rem, 0.92rem + 0.45vw, 1.125rem)", { lineHeight: "1.45" }],
        "fluid-xl": ["clamp(1.125rem, 1rem + 0.65vw, 1.25rem)", { lineHeight: "1.35" }],
        "fluid-2xl": ["clamp(1.25rem, 1.05rem + 1vw, 1.5rem)", { lineHeight: "1.3" }],
        "fluid-3xl": ["clamp(1.5rem, 1.15rem + 1.4vw, 1.875rem)", { lineHeight: "1.25" }],
      },
      colors: {
        // Paleta ajustada a los requerimientos
        primary: {
          50: '#e8edf5',
          100: '#aab8d5',
          200: '#7f97bf',
          300: '#5475a8',
          400: '#3b5f9a',
          500: '#2A497D', // color primario solicitado
          600: '#243e6b',
          700: '#1e355b',
          800: '#172a48',
          900: '#111f36',
        },
        secondary: {
          50: '#fdeff4',
          100: '#f6d6e2',
          200: '#ebb0c2',
          300: '#de7a9e',
          400: '#d25181',
          500: '#c73267', // color secundario solicitado
          600: '#b12d5d',
          700: '#9b2852',
          800: '#842246',
          900: '#6e1d3b',
        },
        azul: '#3099cc', // color azul solicitado
      },
    },
  },
  plugins: [
    typography,
  ],
};

export default config;

