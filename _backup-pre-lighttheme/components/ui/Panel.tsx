import { cn } from '@/lib/utils';

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  eyebrow?: string;
  accent?: 'purple' | 'blue' | 'green' | 'orange' | 'default';
}

const accentBorder: Record<NonNullable<PanelProps['accent']>, string> = {
  purple: 'border-brand-purple/40',
  blue: 'border-brand-blue/40',
  green: 'border-status-success/40',
  orange: 'border-status-triggered/40',
  default: 'border-border',
};

/** Base card used across every dashboard widget — mirrors the bordered panels in the architecture diagram. */
export function Panel({
  title,
  eyebrow,
  accent = 'default',
  className,
  children,
  ...props
}: PanelProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-panel/80 backdrop-blur-sm p-5',
        accentBorder[accent],
        className
      )}
      {...props}
    >
      {(eyebrow || title) && (
        <div className="mb-4">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {eyebrow}
            </p>
          )}
          {title && <h2 className="text-sm font-semibold text-slate-100">{title}</h2>}
        </div>
      )}
      {children}
    </div>
  );
}
