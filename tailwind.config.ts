import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: '#4CAF50',
          hover: '#43A047',
          dark: '#2E7D32',
          light: '#81C784',
          pale: '#E8F5E9',
        },
        'fel-green': '#4CAF50',
        'fel-green-dark': '#2E7D32',
        'fel-green-light': '#81C784',
        'fel-green-pale': '#E8F5E9',
        'fel-forest': '#1A2E1B',
        'fel-night': '#0D1A0E',
        'fel-deepnight': '#0A120A',
        'fel-bg': '#F9FBF9',
        'fel-card': '#F4FAF4',
        'fel-border': '#C8E6C9',
        'fel-muted': '#6B8C6B',
        'fel-brown': '#A0845C',
        'fel-brown-light': '#C8A97A',
      },
      fontFamily: {
        'space': ['var(--font-space-grotesk)', 'Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
