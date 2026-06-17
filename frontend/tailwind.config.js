module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Refined monochrome dark theme
        'dark-bg': '#0f1115',
        'card-bg': '#1e222a',
        'border': '#333944',
        'main': '#f8fafc', // Renamed to 'main' so 'text-main' is generated
        'accent-cyan': '#38bdf8',
        'accent-indigo': '#64748b',
        'accent-red': '#f87171',
        'accent-yellow': '#fbbf24',
        'accent-orange': '#fb923c',
        'accent-green': '#4ade80',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)'],
        mono: ['var(--font-geist-mono)'],
      },
    },
  },
  plugins: [],
}
