'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number toward its target with an ease-out curve, so a live value rolls instead of
 * snapping. Honours `prefers-reduced-motion` by jumping straight to the target.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduce || target === from) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }

    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic — fast start, soft landing.
      setDisplay(Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = target;
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      fromRef.current = target;
    };
  }, [target, durationMs]);

  return display;
}
