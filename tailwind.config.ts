import type { Config } from 'tailwindcss';

/**
 * LeadOps design tokens — light theme.
 *
 * Surfaces step clearly: canvas → card → raised. A card must be obviously a
 * card, not a slightly different shade of the background.
 *
 * Colour has three jobs and never mixes them:
 *  - `accent.*` : module identity (each area of the app owns one hue).
 *  - `status.*` : the five EventStatus values, always shipped with a label.
 *  - `ink/line` : the neutral scale carrying text and rules.
 *
 * `onBrand` is a separate, deliberately theme-independent token: it's the
 * text/icon colour used on top of `bg-brand-gradient` (buttons, active pills,
 * the logo chip). The gradient is the same indigo → violet → fuchsia used on
 * the Home hero, which is dark/saturated across its whole range, so text
 * sitting on it wants to stay white — it must never be aliased to `canvas`,
 * which flips between themes.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ---- Surfaces: each step is a visible move away from the last ----
        canvas: '#F1F4FA',
        card: '#FFFFFF',
        raised: '#F8FAFF',
        sunken: '#E9EEF8',
        line: {
          DEFAULT: '#E2E8F0',
          soft: '#EDF1F7',
          strong: '#C7D2E3',
        },
        // ---- Ink ----
        ink: {
          DEFAULT: '#0F172A',
          secondary: '#334155',
          muted: '#64748B',
          faint: '#94A3B8',
        },
        // ---- Module accents: identity, never state. Same indigo / violet /
        // fuchsia family as the Home hero, plus emerald/amber/rose kept for
        // semantic meaning (success/warning/error) elsewhere in the app. ----
        accent: {
          violet: '#7C3AED',
          indigo: '#4338CA',
          fuchsia: '#C026D3',
          emerald: '#059669',
          amber: '#B45309',
          rose: '#E11D48',
        },
        brand: {
          DEFAULT: '#7C3AED',
          ink: '#5B21B6',
        },
        // ---- Status: reserved, label-paired ----
        status: {
          success: '#15803D',
          running: '#2563EB',
          triggered: '#B45309',
          waiting: '#64748B',
          failed: '#DC2626',
        },
        // Fixed white text/icon colour for anything sitting on bg-brand-gradient.
        onBrand: '#FFFFFF',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        // ---- Per-segment heading typefaces ----
        // Each area of the app owns a distinct display face, the same way it
        // owns an accent hue, so a screenshot of just the heading tells you
        // which part of the product you're looking at.
        home: ['var(--font-home)', 'Georgia', 'serif'],
        dashboard: ['var(--font-dashboard)', 'sans-serif'],
        analytics: ['var(--font-analytics)', 'sans-serif'],
        upload: ['var(--font-upload)', 'sans-serif'],
        journey: ['var(--font-journey)', 'sans-serif'],
        timeline: ['var(--font-timeline)', 'ui-monospace', 'monospace'],
        voice: ['var(--font-voice)', 'sans-serif'],
        traces: ['var(--font-traces)', 'ui-monospace', 'monospace'],
        integrations: ['var(--font-integrations)', 'sans-serif'],
        alerts: ['var(--font-alerts)', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.75rem', { lineHeight: '1.0625rem' }],
        xs: ['0.8125rem', { lineHeight: '1.1875rem' }],
        sm: ['0.9375rem', { lineHeight: '1.4375rem' }],
        base: ['1.0625rem', { lineHeight: '1.625rem' }],
        lg: ['1.1875rem', { lineHeight: '1.75rem' }],
        xl: ['1.375rem', { lineHeight: '1.875rem' }],
        '2xl': ['1.6875rem', { lineHeight: '2.125rem' }],
        '3xl': ['2.0625rem', { lineHeight: '2.375rem' }],
        '4xl': ['2.75rem', { lineHeight: '3rem' }],
        '5xl': ['3.5rem', { lineHeight: '1' }],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.7) inset, 0 12px 24px -14px rgba(15,23,42,0.14)',
        pop: '0 1px 0 0 rgba(255,255,255,0.8) inset, 0 26px 48px -20px rgba(15,23,42,0.24)',
        'glow-brand': '0 10px 26px -8px rgba(124,58,237,0.45)',
      },
      backgroundImage: {
        // Same stops as the Home hero's logo chip and headline gradient.
        'brand-gradient': 'linear-gradient(135deg, #4338CA 0%, #7C3AED 55%, #C026D3 100%)',
      },
      animation: {
        pulseDot: 'pulseDot 2.2s ease-in-out infinite',
        rise: 'rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        slideIn: 'slideIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        packet: 'packet 2.8s linear infinite',
        drawIn: 'drawIn 1.1s ease-out both',
        floatUp: 'floatUp 2.8s ease-in-out infinite',
        ringPulse: 'ringPulse 2.4s cubic-bezier(0.3, 0.6, 0.4, 1) infinite',
        wave: 'wave 1s ease-in-out infinite',
        // ---- Home hero: sequential pipeline reveal + ambient background ----
        popIn: 'popIn 6.4s ease infinite',
        growIn: 'growIn 6.4s ease infinite',
        driftA: 'driftA 22s ease-in-out infinite alternate',
        driftB: 'driftB 26s ease-in-out infinite alternate',
        driftC: 'driftC 19s ease-in-out infinite alternate',
        particleRise: 'particleRise 9s ease-in infinite',
        arrowLoop: 'arrowLoop 1.6s ease-in-out infinite',
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.35', transform: 'scale(0.72)' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        packet: {
          '0%': { left: '-6%', opacity: '0' },
          '12%': { opacity: '1' },
          '88%': { opacity: '1' },
          '100%': { left: '104%', opacity: '0' },
        },
        drawIn: {
          from: { strokeDashoffset: '1000' },
          to: { strokeDashoffset: '0' },
        },
        floatUp: {
          '0%': { transform: 'translateY(10px) scale(0.8)', opacity: '0' },
          '18%': { opacity: '1' },
          '78%': { opacity: '1' },
          '100%': { transform: 'translateY(-42px) scale(1)', opacity: '0' },
        },
        ringPulse: {
          '0%': { transform: 'scale(0.75)', opacity: '0.6' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
        wave: {
          '0%, 100%': { transform: 'scaleY(0.32)' },
          '50%': { transform: 'scaleY(1)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.4) translateY(10px)' },
          '9%': { opacity: '1', transform: 'scale(1.14) translateY(0)' },
          '16%': { transform: 'scale(1)' },
          '82%': { opacity: '1', transform: 'scale(1)' },
          '92%': { opacity: '0', transform: 'scale(0.5) translateY(-6px)' },
          '100%': { opacity: '0', transform: 'scale(0.4) translateY(10px)' },
        },
        growIn: {
          '0%': { opacity: '0', transform: 'scaleY(0)' },
          '6%': { opacity: '1', transform: 'scaleY(1)' },
          '82%': { opacity: '1', transform: 'scaleY(1)' },
          '92%': { opacity: '0', transform: 'scaleY(0)' },
          '100%': { opacity: '0', transform: 'scaleY(0)' },
        },
        driftA: {
          '0%': { transform: 'translate(0,0) scale(1)' },
          '100%': { transform: 'translate(50px,40px) scale(1.12)' },
        },
        driftB: {
          '0%': { transform: 'translate(0,0) scale(1)' },
          '100%': { transform: 'translate(-45px,35px) scale(1.08)' },
        },
        driftC: {
          '0%': { transform: 'translate(0,0) scale(1)' },
          '100%': { transform: 'translate(35px,-35px) scale(1.1)' },
        },
        particleRise: {
          '0%': { opacity: '0', transform: 'translateY(0) scale(0.6)' },
          '12%': { opacity: '0.5' },
          '85%': { opacity: '0.3' },
          '100%': { opacity: '0', transform: 'translateY(-540px) scale(1)' },
        },
        arrowLoop: {
          '0%': { transform: 'translateX(-12px)', opacity: '0' },
          '18%': { opacity: '1' },
          '55%': { transform: 'translateX(3px)', opacity: '1' },
          '80%': { opacity: '0' },
          '100%': { transform: 'translateX(12px)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
