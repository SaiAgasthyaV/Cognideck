import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 20px 60px rgba(15, 23, 42, 0.45)"
      },
      backgroundImage: {
        "hero-radial":
          "radial-gradient(circle at top left, rgba(56, 189, 248, 0.24), transparent 32%), radial-gradient(circle at top right, rgba(99, 102, 241, 0.16), transparent 28%), linear-gradient(180deg, #020617 0%, #0f172a 100%)"
      }
    }
  },
  plugins: []
};

export default config;

