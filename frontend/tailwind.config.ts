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

