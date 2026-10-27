/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['Geist Mono', 'JetBrains Mono', 'SF Mono', 'Segoe UI Mono', 'ui-monospace', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Geist Mono', 'JetBrains Mono', 'SF Mono', 'Segoe UI Mono', 'ui-monospace', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        none: '0px',
        sm: '0px',
        DEFAULT: '0px',
        md: '0px',
        lg: '0px',
        xl: '0px',
        '2xl': '0px',
        '3xl': '0px',
        full: '0px',
      },
      colors: {
        black: '#000000',
        white: '#ffffff',
      },
    },
  },
  plugins: [],
};
