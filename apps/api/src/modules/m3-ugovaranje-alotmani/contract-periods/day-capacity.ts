import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * M3 spec §2.8c — provera kapaciteta se pomera sa PERIODA na DAN.
 *
 * Zašto postoji `capacity_days.units_reserved`, iako §2.8 kaže "prodato se nigde ne upisuje
 * po danu": specifikacija je predviđala da se `CapacityDay` red zaključa i da se stavka
 * rezervacije upiše u ISTOJ transakciji, pa brojač ne bi bio potreban. U stvarnom M5 toku to
 * nije izvodljivo — `confirm()` između rezervacije kapaciteta i upisa `BookingItem`-a zove
 * spoljni API provajder (M4), a HTTP poziv se ne sme držati unutar otvorene DB transakcije.
 * Brava koja se pusti pre upisa stavke ne štiti ni od čega: drugi agent pročita staro stanje.
 *
 * Zato je `units_reserved` BRAVA, ne izvor istine. Prikaz (mreža, izveštaji) i dalje RAČUNA
 * prodato iz `BookingItem`-a, tačno kako spec traži; ovaj brojač samo serijalizuje takmičenje
 * za poslednju jedinicu. Razilaženje to dvoje hvata dnevna provera iz §2.8e.
 *
 * Prvi upis reda za neki datum uzima početnu vrednost IZ postojećih rezervacija — zato
 * zatečeni podaci (rezervacije napravljene pre ovog koda) nisu izgubljeni.
 */

export type DayRejectionReason = 'SALE_STOPPED' | 'CAPACITY_BLOCKED' | 'NO_CAPACITY';

export class DayCapacityError extends BadRequestException {
  constructor(
    readonly reason: DayRejectionReason,
    readonly date: string,
    message: string,
  ) {
    super({ message, reason, date, statusCode: 400 });
  }
}

/** Noći boravka: [stayFrom, stayTo) — noć odjave se ne broji (§2.8c). */
export function nightsBetween(stayFrom: Date, stayTo: Date): string[] {
  const nights: string[] = [];
  const cur = new Date(
    Date.UTC(stayFrom.getUTCFullYear(), stayFrom.getUTCMonth(), stayFrom.getUTCDate()),
  );
  const end = new Date(Date.UTC(stayTo.getUTCFullYear(), stayTo.getUTCMonth(), stayTo.getUTCDate()));
  while (cur < end) {
    nights.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return nights;
}

/**
 * Materijalizuje red za taj datum ako ne postoji, sa početnim brojačem izvedenim iz
 * postojećih rezervacija (vidi objašnjenje na vrhu fajla).
 */
async function materializeDay(
  tx: Prisma.TransactionClient,
  periodId: string,
  date: string,
): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO capacity_days (id, contract_period_id, date, units_reserved, created_at, updated_at)
    SELECT gen_random_uuid(), ${periodId}, ${date}::date, COALESCE((
        SELECT SUM(bi.unit_count)
        FROM booking_items bi
        JOIN rate_lines rl ON rl.id = bi.rate_line_id
        WHERE rl.contract_period_id = ${periodId}
          AND bi.item_status IN ('CONFIRMED', 'PENDING_SUPPLIER_CONFIRMATION')
          AND bi.stay_from <= ${date}::date
          AND bi.stay_to > ${date}::date
      ), 0), now(), now()
    ON CONFLICT (contract_period_id, date) DO NOTHING
  `;
}

/**
 * Atomski uzima `units` jedinica za jednu noć. Vraća `true` ako je uspelo.
 * Uslov u `WHERE` je i provera i brava — dva istovremena zahteva za poslednju jedinicu
 * ne mogu oba proći, jer drugi čeka na red koji prvi drži do kraja transakcije.
 */
async function claimNight(
  tx: Prisma.TransactionClient,
  periodId: string,
  date: string,
  units: number,
  periodCapacity: number,
): Promise<boolean> {
  const affected = await tx.$executeRaw`
    UPDATE capacity_days cd
    SET units_reserved = cd.units_reserved + ${units}, updated_at = now()
    WHERE cd.contract_period_id = ${periodId}
      AND cd.date = ${date}::date
      AND cd.sale_status = 'OPEN'
      AND cd.units_reserved + ${units} + COALESCE((
            SELECT SUM(b.units) FROM capacity_blocks b
            WHERE b.contract_period_id = ${periodId}
              AND b.status = 'ACTIVE'
              AND b.date_from <= cd.date
              AND b.date_to >= cd.date
          ), 0) <= COALESCE(cd.capacity_override, ${periodCapacity})
  `;
  return affected > 0;
}

/**
 * Zašto je zahtev odbijen — tri različite situacije sa tri različita nastavka za agenta
 * (M3 §2.8d): tražiti drugi termin / pitati dobavljača / osloboditi blokadu.
 */
async function explainRejection(
  tx: Prisma.TransactionClient,
  periodId: string,
  date: string,
): Promise<DayRejectionReason> {
  const rows = await tx.$queryRaw<{ sale_status: string; blocked: bigint | null }[]>`
    SELECT cd.sale_status,
           (SELECT SUM(b.units) FROM capacity_blocks b
             WHERE b.contract_period_id = ${periodId}
               AND b.status = 'ACTIVE'
               AND b.date_from <= cd.date
               AND b.date_to >= cd.date) AS blocked
    FROM capacity_days cd
    WHERE cd.contract_period_id = ${periodId} AND cd.date = ${date}::date
  `;
  const row = rows[0];
  if (row?.sale_status === 'STOP') return 'SALE_STOPPED';
  if (row?.blocked && Number(row.blocked) > 0) return 'CAPACITY_BLOCKED';
  return 'NO_CAPACITY';
}

const PORUKE: Record<DayRejectionReason, (d: string) => string> = {
  SALE_STOPPED: (d) => `Prodaja je zatvorena za ${d} (M3 spec §2.8a).`,
  CAPACITY_BLOCKED: (d) => `Kapacitet za ${d} je izuzet blokadom (M3 spec §2.8b).`,
  NO_CAPACITY: (d) => `Nema slobodnih jedinica za noć ${d} (M3 spec §2.8c).`,
};

/**
 * Uzima kapacitet za SVE noći boravka ili nijednu (§2.8c, "sve ili ništa").
 * Poziva se unutar transakcije koju otvara `reserve()`.
 */
export async function claimNights(
  tx: Prisma.TransactionClient,
  periodId: string,
  stayFrom: Date,
  stayTo: Date,
  units: number,
  periodCapacity: number,
): Promise<void> {
  for (const date of nightsBetween(stayFrom, stayTo)) {
    await materializeDay(tx, periodId, date);
    const ok = await claimNight(tx, periodId, date, units, periodCapacity);
    if (!ok) {
      const reason = await explainRejection(tx, periodId, date);
      throw new DayCapacityError(reason, date, PORUKE[reason](date));
    }
  }
}

/** Simetrično `claimNights` — vraća jedinice u prodaju, nikad ispod nule. */
export async function releaseNights(
  tx: Prisma.TransactionClient,
  periodId: string,
  stayFrom: Date,
  stayTo: Date,
  units: number,
): Promise<void> {
  for (const date of nightsBetween(stayFrom, stayTo)) {
    await tx.$executeRaw`
      UPDATE capacity_days
      SET units_reserved = GREATEST(units_reserved - ${units}, 0), updated_at = now()
      WHERE contract_period_id = ${periodId} AND date = ${date}::date
    `;
  }
}

/**
 * M3 spec §2.3e.4 — period čiji je prozor prijave prošao ne sme da primi novu rezervaciju.
 * Ovo NIJE "nema mesta": mesta ima, ali je rok za prijave istekao, pa je i nastavak drugačiji
 * (tražiti produžetak od dobavljača, ne drugi termin).
 */
export function bookingWindowOpen(
  period: { bookingFrom: Date | null; bookingTo: Date | null },
  bookingDate: Date,
): boolean {
  const dan = new Date(
    Date.UTC(bookingDate.getUTCFullYear(), bookingDate.getUTCMonth(), bookingDate.getUTCDate()),
  );
  if (period.bookingFrom && dan < period.bookingFrom) return false;
  if (period.bookingTo && dan > period.bookingTo) return false;
  return true;
}
