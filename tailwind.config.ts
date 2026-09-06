import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17201c",
        porcelain: "#f4f0e7",
        lacquer: "#a82d21",
        jade: "#1d6651",
        brass: "#bc8f4b",
        mist: "#d8dfda"
      },
      boxShadow: {
        paper: "0 22px 60px rgba(35, 39, 35, 0.09)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
      },
    },
  },
  plugins: [],
};

export default config;
