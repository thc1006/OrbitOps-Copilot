/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // OrbitOps palette: dark space backdrop + telco accents
        space: { 900: "#05060f", 800: "#0b0e1f", 700: "#13182e" },
        signal: { ok: "#10b981", warn: "#f59e0b", crit: "#ef4444", info: "#3b82f6" },
      },
    },
  },
  plugins: [],
};
