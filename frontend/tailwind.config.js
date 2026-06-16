/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Google Maps exact palette
        primary: {
          DEFAULT: '#1A73E8',
          dark: '#8AB4F8',
          hover: '#1557B0',
          'dark-hover': '#ADC8FF',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          dark: '#202124',
          secondary: '#F1F3F4',
          'dark-secondary': '#303134',
          tertiary: '#E8EAED',
          'dark-tertiary': '#3C4043',
        },
        border: {
          DEFAULT: '#DADCE0',
          dark: '#5F6368',
        },
        txt: {
          primary: '#202124',
          'primary-dark': '#E8EAED',
          secondary: '#5F6368',
          'secondary-dark': '#9AA0A6',
        },
      },
      boxShadow: {
        // Google Material shadow levels
        google: '0 1px 2px rgba(60,64,67,0.3), 0 2px 6px rgba(60,64,67,0.15)',
        'google-dark': '0 1px 3px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)',
        'google-up': '0 -2px 6px rgba(60,64,67,0.15), 0 -1px 2px rgba(60,64,67,0.1)',
        'google-up-dark': '0 -2px 10px rgba(0,0,0,0.5)',
        float: '0 4px 16px rgba(60,64,67,0.2), 0 1px 3px rgba(60,64,67,0.1)',
        'float-dark': '0 4px 24px rgba(0,0,0,0.6)',
        control: '0 2px 6px rgba(60,64,67,0.25)',
        'control-dark': '0 2px 8px rgba(0,0,0,0.5)',
        card: '0 1px 2px rgba(60,64,67,0.2)',
        'card-dark': '0 1px 4px rgba(0,0,0,0.5)',
      },
      transitionDuration: {
        250: '250ms',
      },
    },
  },
  plugins: [],
}
