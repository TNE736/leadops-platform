/**
 * Brand colours: the single source for tailwind.config.ts (`accent.*`, `brand.*`) and for
 * inline `style` props (SVG strokes, gradients, glows) where Tailwind classes cannot reach.
 * Imported by tailwind.config.ts, so keep this file free of `@/` imports.
 */
export const ACCENT = {
  violet: '#7C3AED',
  indigo: '#4338CA',
  fuchsia: '#C026D3',
  emerald: '#059669',
  amber: '#B45309',
  rose: '#E11D48',
  red: '#DC2626',
} as const;

/** Deep violet for eyebrow text on light surfaces (`text-brand-ink`). */
export const BRAND_INK = '#5B21B6';

/** Tinted icon chip in an accent hue (Panel header icon, StatCard icon). */
export function accentChipStyle(accent: string, ringAlpha = '33') {
  return {
    backgroundColor: `${accent}1F`,
    color: accent,
    boxShadow: `inset 0 0 0 1px ${accent}${ringAlpha}`,
  };
}

/** Logo chip: indigo → violet → fuchsia. */
export const BRAND_GRADIENT = `linear-gradient(135deg,${ACCENT.indigo},${ACCENT.violet},${ACCENT.fuchsia})`;
/** Primary call-to-action buttons. */
export const CTA_GRADIENT = `linear-gradient(120deg,${ACCENT.indigo},${ACCENT.violet})`;
/** Home hero headline highlight. */
export const HERO_TEXT_GRADIENT = `linear-gradient(120deg,${ACCENT.indigo},${ACCENT.violet} 55%,${ACCENT.fuchsia})`;
