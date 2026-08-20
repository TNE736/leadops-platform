/**
 * Small looping "files rising into the cloud" motion graphic for the CSV
 * dropzone's empty state. Built as inline SVG + CSS keyframes (see
 * `floatUp` in tailwind.config.ts) rather than a sourced GIF, so it stays
 * crisp at any size, costs no network weight, and inherits the theme's
 * accent colours instead of shipping a mismatched asset.
 */
export function UploadIllustration() {
  return (
    <div className="relative mb-1 flex h-20 w-36 items-center justify-center" aria-hidden>
      <span
        className="absolute bottom-7 left-8 h-2.5 w-2.5 rounded-[3px] bg-accent-indigo shadow-[0_0_10px_rgba(67,56,202,0.8)] animate-floatUp"
        style={{ animationDelay: '0s' }}
      />
      <span
        className="absolute bottom-7 left-[68px] h-2.5 w-2.5 rounded-[3px] bg-accent-fuchsia shadow-[0_0_10px_rgba(192,38,212,0.8)] animate-floatUp"
        style={{ animationDelay: '0.9s' }}
      />
      <span
        className="absolute bottom-7 left-[98px] h-2.5 w-2.5 rounded-[3px] bg-accent-emerald shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-floatUp"
        style={{ animationDelay: '1.8s' }}
      />
      <svg viewBox="0 0 120 68" className="relative h-14 w-28 drop-shadow-[0_10px_22px_rgba(124,58,237,0.35)]">
        <defs>
          <linearGradient id="uploadCloudGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4338CA" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
        <path
          d="M32 54h54a19 19 0 0 0 2.8-37.8A25 25 0 0 0 40 11.5 17.5 17.5 0 0 0 32 54Z"
          fill="url(#uploadCloudGrad)"
          opacity="0.9"
        />
        <path
          d="M60 46V24m0 0-9 9m9-9 9 9"
          stroke="#FFFFFF"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}
