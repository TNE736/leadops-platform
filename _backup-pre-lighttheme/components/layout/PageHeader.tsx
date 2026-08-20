export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: string;
}) {
  return (
    <div className="mb-8">
      {eyebrow && (
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-purple">
          {eyebrow}
        </p>
      )}
      <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-sm text-slate-400">{description}</p>}
    </div>
  );
}
