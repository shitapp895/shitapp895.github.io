/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6366f1', // Indigo
        secondary: '#8b5cf6', // Violet
        accent: '#ec4899', // Pink
        background: '#f8fafc', // Slate-50
        'background-dark': '#0f172a', // Slate-900
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
