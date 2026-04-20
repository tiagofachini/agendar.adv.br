/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#eef4ff',
          700: '#1644a8',
          800: '#0f3290',
          900: '#0a2070',
        },
        brand: {
          400: '#69dd3a',
          500: '#48b828',
          600: '#2d9017',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
