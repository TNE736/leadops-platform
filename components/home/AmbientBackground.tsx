'use client';

import { useEffect, useState } from 'react';

interface Particle {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
}

/**
 * Slow-drifting gradient blobs plus a scatter of rising particles, fixed to
 * the viewport behind the whole standalone Home page (header + hero — that's
 * the entire page now). Particles are generated client-side only, after
 * mount — doing this with Math.random() during the initial render would
 * produce different markup on the server than on the client and trigger a
 * hydration mismatch.
 */
export function AmbientBackground() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 4 + Math.random() * 6,
        duration: 7 + Math.random() * 6,
        delay: Math.random() * -12,
      }))
    );
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <span
        className="absolute -left-32 -top-40 h-[520px] w-[520px] rounded-full opacity-30 blur-[80px] animate-driftA"
        style={{ background: 'radial-gradient(circle, #4338CA, transparent 70%)' }}
      />
      <span
        className="absolute -right-36 top-24 h-[460px] w-[460px] rounded-full opacity-30 blur-[80px] animate-driftB"
        style={{ background: 'radial-gradient(circle, #C026D3, transparent 70%)' }}
      />
      <span
        className="absolute left-[38%] -bottom-36 h-[380px] w-[380px] rounded-full opacity-25 blur-[80px] animate-driftC"
        style={{ background: 'radial-gradient(circle, #7C3AED, transparent 70%)' }}
      />
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute -bottom-2 rounded-full opacity-0 animate-particleRise"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: 'linear-gradient(135deg,#7C3AED,#C026D3)',
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
