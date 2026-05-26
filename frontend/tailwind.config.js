module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Intelligence terminal theme
        'dark-bg': '#030712',
        'card-bg': '#0B1117',
        'border': '#1F2937',
        'accent-cyan': '#38BDF8',
        'accent-indigo': '#818CF8',
        'accent-red': '#EF4444',
        'accent-yellow': '#FBBF24',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)'],
        mono: ['var(--font-geist-mono)'],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(56, 189, 248, 0.3)',
        'glow-indigo': '0 0 20px rgba(129, 140, 248, 0.3)',
      },
      animation: {
        'pulse-cyan': 'pulse-cyan 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'pulse-cyan': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.5' },
        },
      },
    },
  },
  plugins: [],
}
