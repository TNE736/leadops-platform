'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import type { ParsedLeadRow } from '@/lib/ag-ui/csv';
import { cn } from '@/lib/utils';

export function CsvPreviewTable({ rows, limit = 8 }: { rows: ParsedLeadRow[]; limit?: number }) {
  const shown = rows.slice(0, limit);
  const hiddenCount = rows.length - shown.length;

  return (
    <div className="overflow-x-auto rounded-lg border border-border-soft">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border-soft bg-panel-raised text-slate-500">
            <th className="px-3 py-2 font-medium">Row</th>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Company</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={row.rowNumber} className="border-b border-border-soft last:border-0">
              <td className="px-3 py-2 text-slate-500">{row.rowNumber}</td>
              <td className={cn('px-3 py-2', !row.name && 'text-slate-600 italic')}>
                {row.name || 'missing'}
              </td>
              <td className={cn('px-3 py-2', !row.email && 'text-slate-600 italic')}>
                {row.email || 'missing'}
              </td>
              <td className="px-3 py-2 text-slate-400">{row.company || '—'}</td>
              <td className="px-3 py-2">
                {row.valid ? (
                  <span className="inline-flex items-center gap-1 text-status-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 text-status-failed"
                    title={row.errors.join(', ')}
                  >
                    <XCircle className="h-3.5 w-3.5" /> {row.errors[0]}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hiddenCount > 0 && (
        <p className="border-t border-border-soft px-3 py-2 text-[11px] text-slate-500">
          +{hiddenCount} more row{hiddenCount === 1 ? '' : 's'} not shown
        </p>
      )}
    </div>
  );
}
