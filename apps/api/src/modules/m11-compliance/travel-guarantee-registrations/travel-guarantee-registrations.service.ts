import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TravelGuaranteeRegistration } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import type { CisGatewayAdapter } from '../adapters/cis-gateway-adapter.interface';
import { CIS_GATEWAY_ADAPTER } from '../adapters/cis-gateway.token';

// M11 spec §2.3 — svaka pojedinačna ORGANIZATOR rezervacija mora biti evidentirana u CIS/YUTA
// registru pod sopstvenim brojem, i ta evidencija mora biti skinuta kad se rezervacija storno.
// Deterministički tok (princip #4 Master dokumenta), isti obrazac kao M10 automatsko kreiranje
// SupplierObligation (§8.0 tog dokumenta) — podaci već postoje, nema prostora za AI procenu.
@Injectable()
export class TravelGuaranteeRegistrationsService {
  private readonly logger = new Logger(TravelGuaranteeRegistrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    @Inject(CIS_GATEWAY_ADAPTER) private readonly gateway: CisGatewayAdapter,
  ) {}

  async findMany(filter: { status?: TravelGuaranteeRegistration['status']; bookingId?: string }) {
    return this.prisma.travelGuaranteeRegistration.findMany({
      where: { status: filter.status, bookingId: filter.bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<TravelGuaranteeRegistration> {
    const registration = await this.prisma.travelGuaranteeRegistration.findUnique({ where: { id } });
    if (!registration) throw new NotFoundException(`TravelGuaranteeRegistration ${id} nije pronađen.`);
    return registration;
  }

  // Poziva se iz M11EventSubscribersService na M5 booking.confirmed, samo za
  // tip_nastupanja=ORGANIZATOR. Idempotentno: ako zapis za ovaj booking već postoji, vraća ga.
  async createForBooking(bookingId: string): Promise<TravelGuaranteeRegistration> {
    const existing = await this.prisma.travelGuaranteeRegistration.findUnique({ where: { bookingId } });
    if (existing) return existing;

    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException(`Booking ${bookingId} nije pronađen.`);

    const guarantee = await this.prisma.travelGuarantee.findFirst({ orderBy: { validTo: 'desc' } });
    if (!guarantee) {
      this.logger.warn(`Booking ${bookingId} (ORGANIZATOR) potvrđen bez ijedne unete TravelGuarantee — registracija se ne može pripremiti.`);
      return this.prisma.travelGuaranteeRegistration.create({
        data: { bookingId, travelGuaranteeId: null, status: 'FAILED', failureReason: 'Nijedna garancija putovanja nije uneta u sistem.' },
      });
    }

    const registration = await this.prisma.travelGuaranteeRegistration.create({
      data: { bookingId, travelGuaranteeId: guarantee.id, status: 'PENDING' },
    });

    return this.attemptRegister(registration, guarantee.id, guarantee.policyNumber, booking.bookingNumber);
  }

  private async attemptRegister(
    registration: TravelGuaranteeRegistration,
    travelGuaranteeId: string,
    policyNumber: string,
    bookingNumber: string,
  ): Promise<TravelGuaranteeRegistration> {
    try {
      const result = await this.gateway.register({
        bookingId: registration.bookingId,
        bookingNumber,
        travelGuaranteeId,
        policyNumber,
      });
      const updated = await this.prisma.travelGuaranteeRegistration.update({
        where: { id: registration.id },
        data: { status: 'REGISTERED', cisRegistrationNumber: result.cisRegistrationNumber, registeredAt: new Date(), failureReason: null },
      });
      await this.auditLog.write({
        actorType: 'SYSTEM',
        module: 'M11',
        action: 'travel_guarantee_registration.registered',
        resourceType: 'TravelGuaranteeRegistration',
        resourceId: updated.id,
        afterState: updated,
      });
      return updated;
    } catch (err) {
      const updated = await this.prisma.travelGuaranteeRegistration.update({
        where: { id: registration.id },
        data: { status: 'FAILED', failureReason: (err as Error).message },
      });
      await this.auditLog.write({
        actorType: 'SYSTEM',
        module: 'M11',
        action: 'travel_guarantee_registration.failed',
        resourceType: 'TravelGuaranteeRegistration',
        resourceId: updated.id,
        afterState: updated,
      });
      return updated;
    }
  }

  // Poziva se iz M11EventSubscribersService na M5 booking.cancelled, samo za
  // tip_nastupanja=ORGANIZATOR sa postojećim zapisom.
  async releaseForBooking(bookingId: string): Promise<TravelGuaranteeRegistration | null> {
    const registration = await this.prisma.travelGuaranteeRegistration.findUnique({ where: { bookingId } });
    if (!registration) return null;
    if (registration.status === 'RELEASED' || registration.status === 'RELEASE_PENDING') return registration;

    const pending = await this.prisma.travelGuaranteeRegistration.update({
      where: { id: registration.id },
      data: { status: 'RELEASE_PENDING', releaseRequestedAt: new Date() },
    });

    return this.attemptRelease(pending);
  }

  private async attemptRelease(registration: TravelGuaranteeRegistration): Promise<TravelGuaranteeRegistration> {
    if (!registration.cisRegistrationNumber) {
      // Nikad nije uspešno registrovan u CIS-u (status je bio FAILED/PENDING) — nema šta da se
      // skine, storno ne treba dalju CIS akciju. Direktno RELEASED.
      const released = await this.prisma.travelGuaranteeRegistration.update({
        where: { id: registration.id },
        data: { status: 'RELEASED', releasedAt: new Date() },
      });
      return released;
    }

    try {
      await this.gateway.release({ cisRegistrationNumber: registration.cisRegistrationNumber });
      const updated = await this.prisma.travelGuaranteeRegistration.update({
        where: { id: registration.id },
        data: { status: 'RELEASED', releasedAt: new Date(), failureReason: null },
      });
      await this.auditLog.write({
        actorType: 'SYSTEM',
        module: 'M11',
        action: 'travel_guarantee_registration.released',
        resourceType: 'TravelGuaranteeRegistration',
        resourceId: updated.id,
        afterState: updated,
      });
      return updated;
    } catch (err) {
      const updated = await this.prisma.travelGuaranteeRegistration.update({
        where: { id: registration.id },
        data: { failureReason: (err as Error).message },
      });
      return updated;
    }
  }

  // §5 — POST /travel-guarantee-registrations/:id/retry — ručno ponovi registraciju ili
  // skidanje opterećenja koje je FAILED/zaglavljeno u RELEASE_PENDING.
  async retry(id: string, actor: { userId: string }): Promise<TravelGuaranteeRegistration> {
    let registration = await this.findOne(id);

    if (registration.status === 'PENDING' || registration.status === 'FAILED') {
      // §2.3 — ako registracija nastala pre nego što je ijedna garancija postojala (FAILED bez
      // travel_guarantee_id), retry prvo pokuša da je poveže sa trenutno važećom garancijom.
      let travelGuaranteeId = registration.travelGuaranteeId;
      if (!travelGuaranteeId) {
        const latest = await this.prisma.travelGuarantee.findFirst({ orderBy: { validTo: 'desc' } });
        if (!latest) throw new BadRequestException('Nije moguće ponoviti registraciju — nijedna garancija putovanja još nije uneta.');
        travelGuaranteeId = latest.id;
        registration = await this.prisma.travelGuaranteeRegistration.update({ where: { id }, data: { travelGuaranteeId } });
      }

      const guarantee = await this.prisma.travelGuarantee.findUnique({ where: { id: travelGuaranteeId } });
      const booking = await this.prisma.booking.findUnique({ where: { id: registration.bookingId } });
      if (!guarantee || !booking) {
        throw new BadRequestException('Nije moguće ponoviti registraciju — garancija ili rezervacija ne postoji.');
      }
      const result = await this.attemptRegister(registration, travelGuaranteeId, guarantee.policyNumber, booking.bookingNumber);
      await this.auditLog.write({
        actorType: 'HUMAN',
        actorId: actor.userId,
        module: 'M11',
        action: 'travel_guarantee_registration.retry',
        resourceType: 'TravelGuaranteeRegistration',
        resourceId: id,
        afterState: result,
      });
      return result;
    }

    if (registration.status === 'RELEASE_PENDING') {
      const result = await this.attemptRelease(registration);
      await this.auditLog.write({
        actorType: 'HUMAN',
        actorId: actor.userId,
        module: 'M11',
        action: 'travel_guarantee_registration.retry_release',
        resourceType: 'TravelGuaranteeRegistration',
        resourceId: id,
        afterState: result,
      });
      return result;
    }

    throw new BadRequestException(`TravelGuaranteeRegistration ${id} nije u statusu koji dozvoljava ponovni pokušaj (status: ${registration.status}).`);
  }

  // §2.3 alarm 1 — CONFIRMED rezervacija bez status=REGISTERED duže od 48h.
  async findMissingRegistrationOlderThan(hours = 48): Promise<TravelGuaranteeRegistration[]> {
    const threshold = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.prisma.travelGuaranteeRegistration.findMany({
      where: { status: { in: ['PENDING', 'FAILED'] }, createdAt: { lt: threshold } },
    });
  }

  // §2.3 alarm 2 — CANCELLED rezervacija čiji zapis ostaje RELEASE_PENDING duže od 48h.
  async findReleasePendingOlderThan(hours = 48): Promise<TravelGuaranteeRegistration[]> {
    const threshold = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.prisma.travelGuaranteeRegistration.findMany({
      where: { status: 'RELEASE_PENDING', releaseRequestedAt: { lt: threshold } },
    });
  }
}
