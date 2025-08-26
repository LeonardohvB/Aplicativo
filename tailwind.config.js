/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  safelist: [
    'bg-blue-500',
    'peer-checked:bg-blue-500',
    'bg-red-500'
  ],
  plugins: [],
};
