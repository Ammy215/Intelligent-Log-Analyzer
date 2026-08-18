/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#050d1a',
          secondary: '#0a1628',
          tertiary: '#0f1e35',
          elevated: '#122544',
          border: '#1a2d4a',
          input: '#0d1e38',
        },
        // One brand accent (cyan) for primary actions/links/focus/active-nav —
        // used sparingly, on purpose. Severity/status colors are semantic-only
        // and must never double as the UI accent (MEDIUM used to be cyan,
        // which diluted both meanings — moved to `info` blue instead).
        accent: {
          cyan: '#00d4ff',
          green: '#00ff88',
          amber: '#ffb800',
          red: '#ff3366',
          purple: '#8b5cf6',
          info: '#5b8cff',
        },
        text: {
          primary: '#e2e8f0',
          secondary: '#8598b3',
          muted: '#7385a1',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 10px 30px -12px rgba(0,0,0,0.55)',
        elevated: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 16px 40px -14px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,212,255,0.08)',
        glow: '0 0 0 1px rgba(0,212,255,0.15), 0 0 24px -4px rgba(0,212,255,0.25)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        pulse: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s linear infinite',
        pulse: 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        fadeIn: 'fadeIn 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
