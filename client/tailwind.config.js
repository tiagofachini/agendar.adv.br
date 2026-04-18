/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef2ff',
          700: '#1e3a5f',
          800: '#162d4a',
          900: '#0f1f35',
        },
        gold: {
          400: '#f0c040',
          500: '#c9a227',
          600: '#a07c1a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
