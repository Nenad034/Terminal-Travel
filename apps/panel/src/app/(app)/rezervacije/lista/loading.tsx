import Skeleton, { TableSkeleton } from '@/components/Skeleton';

// Nalaz 4.2 (dok. 39) — dok server prikuplja rezervacije + tri liste za filtere (grane,
// zaposleni, dobavljači), Next.js prikazuje OVO umesto praznog ekrana.
export default function Loading() {
  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">Lista rezervacija</h1>
        <Skeleton className="h-6 w-40" />
      </div>
      <Skeleton className="mb-3 h-9 w-full" />
      <TableSkeleton rows={10} cols={6} />
    </div>
  );
}
