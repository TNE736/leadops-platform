/**
 * Tiny animated waveform used anywhere a voice call is actively in
 * progress — a live "audio is moving" cue next to the status text, built
 * from five bars on staggered `wave` keyframes rather than a stock GIF.
 */
export function CallWaveBars({ color = '#B45309' }: { color?: string }) {
  return (
    <span className="inline-flex h-4 items-end gap-[3px]" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[3px] origin-bottom rounded-full animate-wave"
          style={{ backgroundColor: color, height: '100%', animationDelay: `${i * 0.11}s` }}
        />
      ))}
    </span>
  );
}
