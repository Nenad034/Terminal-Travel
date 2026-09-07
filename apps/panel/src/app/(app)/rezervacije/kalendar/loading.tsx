import Skeleton from '@/components/Skeleton';

// Nalaz 4.2 (dok. 39) — kalendar učitava sve rezervacije za prikazani mesec/nedelju sa servera
// pre prvog rendera; ovo je oblik grida dok se taj upit završi.
export default function Loading() {
  return (
    <div className="p-6">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-56" />
      </div>
      <Skeleton className="mb-3 h-9 w-full" />
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}
