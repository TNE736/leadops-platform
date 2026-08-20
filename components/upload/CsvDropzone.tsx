'use client';

import { useCallback, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Drop zone for adding CSV files to the upload queue. Selection alone never
 * triggers ingestion — that only happens when the page's Upload button is clicked.
 */
export function CsvDropzone({
  onFiles,
  queuedCount = 0,
}: {
  onFiles: (files: File[]) => void;
  queuedCount?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const csvFiles = Array.from(fileList).filter(
        (f) => f.name.toLowerCase().endsWith('.csv') || f.type === 'text/csv'
      );
      if (csvFiles.length > 0) onFiles(csvFiles);
    },
    [onFiles]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      className={cn(
        'group relative flex cursor-pointer flex-col items-center justify-center gap-2.5 overflow-hidden rounded-2xl border border-dashed px-6 py-14 text-center transition-all duration-300',
        dragging
          ? 'border-brand bg-brand/12 shadow-glow-brand'
          : 'border-line-strong bg-sunken hover:border-brand/60 hover:bg-raised'
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-brand-gradient opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-15"
      />
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-line bg-sunken backdrop-blur transition-transform duration-300 group-hover:scale-110">
        <UploadCloud className="h-6 w-6 text-brand-ink" />
      </span>
      <p className="relative mt-2 text-base font-medium text-ink">
        {queuedCount > 0
          ? 'Drop more CSVs here, or click to add another'
          : 'Drop your Leads CSV here, or click to browse'}
      </p>
      <p className="relative text-xs text-ink-muted">CSV files only · parsed in your browser</p>
    </div>
  );
}
