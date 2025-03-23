/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'sc-blue': '#0070ff',
        'sc-dark': '#0a0a0a',
        'sc-light': '#f0f0f0',
        'sc-accent': '#d4af37',
      },
      fontFamily: {
        'mono': ['"Space Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
} 