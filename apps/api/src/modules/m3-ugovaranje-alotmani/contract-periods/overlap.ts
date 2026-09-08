import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * M3 spec §2.3b + §2.3e.2 — dva `ContractPeriod` istog `contract_id`+`room_type` ne smeju
 * se preseći. Deljeno između `ContractPeriodsService` (ručno kreiranje) i
 * `PricelistImportsService` (kreiranje iz odobrenog reda uvoza) — ista provera na oba ulaza.
 *
 * Dopuna v1.20: sukob traži da se preseku OBA opsega — i boravak i prozor prijave.
 * Bez toga bi sistem odbio potpuno ispravan unos iz prakse: "isti boravak, 10 soba za
 * prijave do 31.3. i 5 za prijave posle" (§2.3e). Prozor koji nije upisan znači "uvek",
 * pa se seče sa svakim — period bez prozora i period sa prozorom nad istim boravkom
 * JESU sukob, jer bi za datum unutar prozora važila oba.
 */
export async function assertNoContractPeriodOverlap(
  prisma: PrismaService,
  contractId: string,
  roomType: string,
  stayFrom: Date,
  stayTo: Date,
  excludePeriodId?: string,
  booking?: { from: Date | null; to: Date | null },
): Promise<void> {
  // Prozor prijave je inkluzivan na oba kraja ("do 31.3." uključuje 31.3.), za razliku od
  // boravka koji je poluotvoren [from, to) jer se noć odjave ne broji.
  const bookingFilters: Prisma.ContractPeriodWhereInput[] = [];
  if (booking?.to) {
    bookingFilters.push({ OR: [{ bookingFrom: null }, { bookingFrom: { lte: booking.to } }] });
  }
  if (booking?.from) {
    bookingFilters.push({ OR: [{ bookingTo: null }, { bookingTo: { gte: booking.from } }] });
  }

  const conflicting = await prisma.contractPeriod.findFirst({
    where: {
      contractId,
      roomType,
      id: excludePeriodId ? { not: excludePeriodId } : undefined,
      stayFrom: { lt: stayTo },
      stayTo: { gt: stayFrom },
      ...(bookingFilters.length ? { AND: bookingFilters } : {}),
    },
  });
  if (conflicting) {
    const prozor =
      conflicting.bookingFrom || conflicting.bookingTo
        ? `, prijave ${conflicting.bookingFrom?.toISOString().slice(0, 10) ?? '—'}–${conflicting.bookingTo?.toISOString().slice(0, 10) ?? '—'}`
        : '';
    throw new BadRequestException(
      `Period se datumski preklapa sa postojećim periodom ${conflicting.id} (${conflicting.stayFrom.toISOString().slice(0, 10)}–${conflicting.stayTo.toISOString().slice(0, 10)}${prozor}) za istu sobu (M3 spec §2.3b/§2.3e.2)`,
    );
  }
}
