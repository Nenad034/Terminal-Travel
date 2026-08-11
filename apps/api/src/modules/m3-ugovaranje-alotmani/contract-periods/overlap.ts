import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * M3 spec §2.3b — dva `ContractPeriod` istog `contract_id`+`room_type` ne smeju se
 * datumski preseći. Deljeno između `ContractPeriodsService` (ručno kreiranje) i
 * `PricelistImportsService` (kreiranje iz odobrenog reda uvoza) — ista provera na oba
 * ulaza, jer sukob je dvosmislen bez obzira na to odakle period dolazi (§2.3b).
 */
export async function assertNoContractPeriodOverlap(
  prisma: PrismaService,
  contractId: string,
  roomType: string,
  stayFrom: Date,
  stayTo: Date,
  excludePeriodId?: string,
): Promise<void> {
  const conflicting = await prisma.contractPeriod.findFirst({
    where: {
      contractId,
      roomType,
      id: excludePeriodId ? { not: excludePeriodId } : undefined,
      stayFrom: { lt: stayTo },
      stayTo: { gt: stayFrom },
    },
  });
  if (conflicting) {
    throw new BadRequestException(
      `Period se datumski preklapa sa postojećim periodom ${conflicting.id} (${conflicting.stayFrom.toISOString().slice(0, 10)}–${conflicting.stayTo.toISOString().slice(0, 10)}) za istu sobu (M3 spec §2.3b)`,
    );
  }
}
