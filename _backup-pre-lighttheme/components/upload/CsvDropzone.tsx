'use client';

import { useCallback, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Drop zone for adding one or more CSV files to the upload queue. Selection alone never triggers ingestion — that only happens when the page's Upload button is clicked. */
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
        'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
        dragging
          ? 'border-brand-purple bg-brand-purple/10'
          : 'border-border hover:border-brand-purple/50 hover:bg-panel-raised/50'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          // Allow selecting the same file again after removing it from the queue.
          e.target.value = '';
        }}
      />
      <UploadCloud className="h-8 w-8 text-slate-500" />
      <div>
        <p className="text-sm font-medium text-slate-200">
          {queuedCount > 0
            ? 'Drop more CSVs here, or click to add another'
            : 'Drop one or more leads CSVs here, or click to browse'}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Expected columns: name, email, company (aliases like &ldquo;full name&rdquo; and
          &ldquo;organization&rdquo; are recognized too)
        </p>
      </div>
    </div>
  );
}
