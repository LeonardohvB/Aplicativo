/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      keyframes: {
        'toast-in': {
          '0%':   { opacity: '0', transform: 'translateY(-6px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'dialog-in': {
          '0%':   { opacity: '0', transform: 'translateY(6px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'toast-in':  'toast-in .18s ease-out both',
        'dialog-in': 'dialog-in .18s ease-out both',
        'fade-in':   'fade-in .18s ease-out both',
      },
    },
  },
  safelist: [
    'animate-toast-in',
    'animate-dialog-in',
    'animate-fade-in',
  ],
  plugins: [],
};
