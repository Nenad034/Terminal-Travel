import Skeleton, { TableSkeleton } from '@/components/Skeleton';

// Nalaz 4.2 (dok. 39) — izveštaji su bili nalaz 2.3 (N+1 upiti, sad rešeno keširanjem/agregacijom
// — vidi tu stavku), ali i dalje čitaju ceo skup rezervacija pri svakom osvežavanju. Ovo je oblik
// naslova + tabova + tabele dok se agregacija završi.
export default function Loading() {
  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="mb-4 flex gap-1 border-b border-border pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-24" />
        ))}
      </div>
      <TableSkeleton rows={6} cols={4} />
    </div>
  );
}
