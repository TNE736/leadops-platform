'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import type { ParsedLeadRow } from '@/lib/ag-ui/csv';
import { cn } from '@/lib/utils';

export function CsvPreviewTable({ rows, limit = 8 }: { rows: ParsedLeadRow[]; limit?: number }) {
  const shown = rows.slice(0, limit);
  const hiddenCount = rows.length - shown.length;

  return (
    <div className="overflow-x-auto border-t border-line-soft">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-line-soft text-[11px] uppercase tracking-[0.12em] text-ink-faint">
            <th scope="col" className="px-4 py-2.5 font-semibold">Row</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Name</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Email</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Company</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {shown.map((row) => (
            <tr key={row.rowNumber} className="transition-colors hover:bg-raised">
              <td className="px-4 py-2.5 tabular-nums text-ink-faint">{row.rowNumber}</td>
              <td className={cn('px-4 py-2.5', row.name ? 'text-ink' : 'italic text-ink-faint')}>
                {row.name || 'missing'}
              </td>
              <td
                className={cn(
                  'px-4 py-2.5',
                  row.email ? 'text-ink-secondary' : 'italic text-ink-faint'
                )}
              >
                {row.email || 'missing'}
              </td>
              <td className="px-4 py-2.5 text-ink-secondary">{row.company || '—'}</td>
              <td className="px-4 py-2.5">
                {row.valid ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-status-success">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Valid
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 font-medium text-status-failed"
                    title={row.errors.join(', ')}
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden /> {row.errors[0]}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hiddenCount > 0 && (
        <p className="border-t border-line-soft px-4 py-2.5 text-[11px] text-ink-muted">
          +{hiddenCount} more row{hiddenCount === 1 ? '' : 's'} not shown
        </p>
      )}
    </div>
  );
}
