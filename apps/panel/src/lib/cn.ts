import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// shadcn/ui standardni helper — spaja Tailwind klase i razrešava konflikte
// (npr. "p-2 p-4" -> "p-4"), koristi ga svaka ui/ komponenta ispod.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
