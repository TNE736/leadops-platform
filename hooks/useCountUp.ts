'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number toward its target with an ease-out curve.
 *
 * Used by the KPI band so a value never just snaps — it rolls to the new
 * figure, which is what makes a live dashboard feel live. Honours
 * `prefers-reduced-motion` by jumping straight to the target.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduce || target === fromRef.current) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }

    const from = fromRef.current;
    const delta = target - from;
    startRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      // easeOutCubic — fast start, soft landing.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + delta * eased));
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      fromRef.current = target;
    };
  }, [target, durationMs]);

  return display;
}
