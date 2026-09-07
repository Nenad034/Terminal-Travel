// Nalaz 4.2 (dok. 39) — nijedan ekran nema loading.tsx, pa Next.js prikazuje prazan ekran dok
// server komponenta čeka apps/api. Ovo je gradivni blok za loading.tsx fajlove sporijih ekrana
// (liste, kalendar, izveštaji) — ne zamenjuje pravi sadržaj, samo daje obrisu oblik dok se čeka.
export default function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-panel2 ${className}`} />;
}

/** Red tabele — koristi se u petlji za `TableSkeleton`. */
export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded border border-border p-2">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className={`h-4 ${j === 0 ? 'w-8' : 'flex-1'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
