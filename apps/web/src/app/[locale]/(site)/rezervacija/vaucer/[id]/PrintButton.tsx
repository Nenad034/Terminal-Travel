'use client';

// Štampanje ide preko browser-a (Ctrl+P / Print to PDF) — namerno bez nove biblioteke/servisa
// za generisanje PDF-a (M5 spec §6 dopuna 2.9.2026: format vaučera dobija prvi sadržaj kroz ovu
// stranicu, izbor stvarne PDF tehnologije ostaje otvoren dok se za to ne ukaže potreba).
export default function PrintButton({ label }: { label: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
    >
      {label}
    </button>
  );
}
