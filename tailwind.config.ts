import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        raised: "rgb(var(--raised) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-soft": "rgb(var(--accent-soft) / <alpha-value>)",
        "accent-2": "rgb(var(--accent-2) / <alpha-value>)",
        "accent-2-soft": "rgb(var(--accent-2-soft) / <alpha-value>)",
        "accent-3": "rgb(var(--accent-3) / <alpha-value>)",
        "accent-3-soft": "rgb(var(--accent-3-soft) / <alpha-value>)",
        unvisited: "rgb(var(--unvisited) / <alpha-value>)",
      },
      fontFamily: {
        serif: ["Fraunces", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "1.25rem",
      },
      maxWidth: {
        shell: "72rem",
      },
    },
  },
  plugins: [],
};
export default config;
