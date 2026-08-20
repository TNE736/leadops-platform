/**
 * Expanding "all clear" radar rings, layered behind a status icon to signal
 * an actively healthy system rather than a static empty state.
 */
export function RadarPulse({ color = '#15803D' }: { color?: string }) {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden>
      <span
        className="absolute inset-0 rounded-full animate-ringPulse"
        style={{ boxShadow: `0 0 0 1px ${color}` }}
      />
      <span
        className="absolute inset-0 rounded-full animate-ringPulse"
        style={{ boxShadow: `0 0 0 1px ${color}`, animationDelay: '0.9s' }}
      />
    </span>
  );
}
