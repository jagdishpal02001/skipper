/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/popup/**/*.{ts,tsx,html}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          400: '#4f9dff',
          500: '#2b82f6',
          600: '#1a6ae0',
          700: '#1657b4',
        },
        surface: {
          900: '#0f1115',
          800: '#171a21',
          700: '#1f232c',
          600: '#2a2f3a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
