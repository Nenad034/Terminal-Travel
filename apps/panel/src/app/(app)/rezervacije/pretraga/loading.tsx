import Skeleton from '@/components/Skeleton';

// Nalaz 4.2 (dok. 39) — poslata pretraga poziva spoljne provajdere (M4) pre nego što server
// komponenta uopšte počne da renderuje; ovo je oblik forme + kartica rezultata dok se čeka.
export default function Loading() {
  return (
    <div className="p-6">
      <Skeleton className="mb-4 h-9 w-full" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
