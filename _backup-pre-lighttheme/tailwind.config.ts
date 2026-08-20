import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Base surfaces — deep navy/black, matching the architecture diagram
        canvas: '#05070f',
        panel: '#0b0f1d',
        'panel-raised': '#101527',
        border: {
          DEFAULT: '#1c2338',
          soft: '#161b2e',
        },
        // Brand gradient accents (Next.js frontend header uses purple -> blue)
        brand: {
          purple: '#8b5cf6',
          blue: '#3b82f6',
          cyan: '#22d3ee',
        },
        // Event status legend
        status: {
          success: '#22c55e',
          running: '#3b82f6',
          triggered: '#f97316',
          waiting: '#9ca3af',
          failed: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(139,92,246,0.15), 0 0 24px rgba(59,130,246,0.08)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(90deg, #8b5cf6 0%, #3b82f6 100%)',
        'canvas-fade': 'radial-gradient(120% 120% at 50% -10%, #131a30 0%, #05070f 60%)',
      },
      animation: {
        pulseDot: 'pulseDot 1.6s ease-in-out infinite',
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.85)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
