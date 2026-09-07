import Skeleton from '@/components/Skeleton';

// Nalaz 4.2 (dok. 39) — dosije rezervacije je najveći ekran u panelu (preko 1700 linija,
// više paralelnih upita zavisno od aktivnog taba); ovo je oblik naslova + tabova + kartica
// dok se prvi upit završi.
export default function Loading() {
  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-24" />
        </div>
      </div>
      <div className="mb-4 flex gap-1 border-b border-border pb-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
