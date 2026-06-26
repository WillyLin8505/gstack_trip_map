import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#FAFAF7",
        foreground: "#1C1C1A",
        accent: {
          DEFAULT: "#E8762C",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#F3F3EF",
          foreground: "#6B6B68",
        },
        border: "#E5E5E1",
        // 7-colour day palette
        day: {
          1: "#E8762C",
          2: "#0D9488",
          3: "#E11D48",
          4: "#7C3AED",
          5: "#0284C7",
          6: "#65A30D",
          7: "#EA580C",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "Noto Sans TC", "sans-serif"],
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
    },
  },
  plugins: [],
};

export default config;
