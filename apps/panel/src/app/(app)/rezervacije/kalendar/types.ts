export interface DaySummary {
  date: string;
  arrivalsCount: number;
  departuresCount: number;
  stayoversCount: number;
  singleDayCount: number;
}

export interface DayDetailEntry {
  bookingItemId: string;
  bookingId: string;
  bookingNumber: string;
  productId: string;
  status: string;
  guests: string[];
  bookingStatus: string;
  paymentStatus: string;
  productType: string;
  destinationCity: string;
  destinationCountry: string;
  unitCount: number;
  finalPrice: number;
  finalPriceCurrency: string;
}

export interface DayDetail {
  ARRIVAL: DayDetailEntry[];
  DEPARTURE: DayDetailEntry[];
  STAYOVER: DayDetailEntry[];
  SINGLE_DAY: DayDetailEntry[];
}

export const EMPTY_DAY_DETAIL: DayDetail = { ARRIVAL: [], DEPARTURE: [], STAYOVER: [], SINGLE_DAY: [] };

export function dayDetailCount(d: DayDetail): number {
  return d.ARRIVAL.length + d.DEPARTURE.length + d.STAYOVER.length + d.SINGLE_DAY.length;
}

export function allEntries(d: DayDetail): DayDetailEntry[] {
  return [...d.ARRIVAL, ...d.DEPARTURE, ...d.STAYOVER, ...d.SINGLE_DAY];
}
