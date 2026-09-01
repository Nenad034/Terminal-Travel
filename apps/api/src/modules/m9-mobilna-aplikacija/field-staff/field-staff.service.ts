import { ForbiddenException, Injectable } from '@nestjs/common';
import { BookingItemStatus, FieldIncidentSeverity } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { EventBusService } from '../../../common/events/event-bus.service';
import { PermissionsService } from '../../m1-core-identitet/permissions/permissions.service';
import { FieldCheckInSyncDto, FieldIncidentNoteSyncDto, SyncFieldDataDto } from './dto/sync-field-data.dto';

// M9 spec §3.2 — stavke aktivne za itinerar/sinhronizaciju (otkazane stavke ne pripadaju
// itineraru vodiča, isti skup statusa kao M5 kalendar/duplikat provera).
const ACTIVE_ITEM_STATUSES: BookingItemStatus[] = [BookingItemStatus.CONFIRMED, BookingItemStatus.PENDING_SUPPLIER_CONFIRMATION];

/**
 * M9 spec §3.2/§3.3 — deo za vodiče na terenu (offline-first). Agregacioni servis: kompozicija
 * preko M5 (BookingItem/Booking/BookingItemGuest) i M6 (GuestProfile), isti princip kao M17
 * ("vodič ne dobija sirov pristup bazama tih modula" — samo preko ove agregacije). Weak
 * reference (bez Prisma @relation) ka M5/M6/M1 entitetima, isti obrazac kao ostali cross-modul
 * pristupi (npr. M14 TicketsService.relatedBooking).
 */
@Injectable()
export class FieldStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly eventBus: EventBusService,
    private readonly permissions: PermissionsService,
  ) {}

  // §3.2 — GET /mobile/staff/my-itinerary?from=&to=
  async myItinerary(guideUserId: string, from: Date, to: Date) {
    const items = await this.prisma.bookingItem.findMany({
      where: {
        assignedGuideId: guideUserId,
        itemStatus: { in: ACTIVE_ITEM_STATUSES },
        stayFrom: { lte: to },
        stayTo: { gte: from },
      },
      include: { booking: true, guests: true, product: true },
      orderBy: { stayFrom: 'asc' },
    });

    const guestProfileIds = items.flatMap((item) => item.guests.map((g) => g.guestProfileId).filter((id): id is string => !!id));
    const guestProfiles = guestProfileIds.length
      ? await this.prisma.guestProfile.findMany({ where: { id: { in: guestProfileIds } } })
      : [];
    const profileById = new Map(guestProfiles.map((p) => [p.id, p]));

    return items.map((item) => ({
      bookingItemId: item.id,
      bookingId: item.bookingId,
      bookingNumber: item.booking.bookingNumber,
      productId: item.productId,
      destinationCountry: item.product.destinationCountry,
      destinationCity: item.product.destinationCity,
      stayFrom: item.stayFrom,
      stayTo: item.stayTo,
      itemStatus: item.itemStatus,
      // §3.1 "vaučeri (referenca/sadržaj iz M5)" — Booking.voucherUrl je već postojeća M5
      // referenca (isti polje koje M8/M9 gost tok koristi), bez dupliranja u M9.
      voucherUrl: item.booking.voucherUrl,
      guests: item.guests.map((g) => {
        const profile = g.guestProfileId ? profileById.get(g.guestProfileId) : undefined;
        return {
          bookingItemGuestId: g.id,
          firstName: g.guestFirstName,
          lastName: g.guestLastName,
          email: profile?.email ?? null,
          phone: profile?.phone ?? null,
          preferences: profile?.preferences ?? null,
        };
      }),
    }));
  }

  // §3.2 — POST /mobile/staff/sync. Idempotentno po klijentski generisanom id (isti obrazac
  // kao M4/M10 idempotency_key): ponovljen isti id ne pravi duplikat, samo potvrđuje synced_at.
  // "Poslednji upis pobeđuje" po vremenskoj oznaci ako se isti id pošalje sa različitim sadržajem.
  /**
   * §3.2 dopuna (1.9.2026) — pregled prijava sa terena ZA JEDNU REZERVACIJU, iz kancelarije.
   * Do ove dopune je `FieldCheckIn` mogao samo da se UPIŠE (POST /sync sa telefona vodiča) i
   * nikad da se pročita — pa kartica "Predstavnici" na ekranu rezervacije (M5 spec §4.5) nije
   * imala odakle da prikaže da li je iko stvarno preuzeo goste na destinaciji.
   *
   * Ne uvodi novo pravo nad rezervacijom: pozivalac mora imati `M9/field-checkin/VIEW`, a
   * prikazuju se isključivo prijave za stavke TE rezervacije.
   */
  async checkInsForBooking(bookingId: string) {
    const guests = await this.prisma.bookingItemGuest.findMany({
      where: { bookingItem: { bookingId } },
      select: { id: true, bookingItemId: true, guestFirstName: true, guestLastName: true },
    });
    if (guests.length === 0) return [];

    const checkIns = await this.prisma.fieldCheckIn.findMany({
      where: { bookingItemGuestId: { in: guests.map((g) => g.id) } },
      orderBy: { checkedInAt: 'desc' },
    });
    const guestById = new Map(guests.map((g) => [g.id, g]));

    return checkIns.map((c) => ({
      id: c.id,
      bookingItemId: guestById.get(c.bookingItemGuestId)?.bookingItemId ?? null,
      guestName: `${guestById.get(c.bookingItemGuestId)?.guestFirstName ?? ''} ${guestById.get(c.bookingItemGuestId)?.guestLastName ?? ''}`.trim(),
      checkedInAt: c.checkedInAt,
      checkedInBy: c.checkedInBy,
      syncedAt: c.syncedAt,
    }));
  }

  async sync(guideUserId: string, dto: SyncFieldDataDto) {
    if (dto.incidentNotes?.length) {
      const allowed = await this.permissions.hasPermission(guideUserId, 'M9', 'field-incident', 'CREATE');
      if (!allowed) throw new ForbiddenException('Nema dozvolu M9/field-incident/CREATE');
    }

    const checkIns = [];
    for (const item of dto.checkIns ?? []) {
      checkIns.push(await this.syncCheckIn(item, guideUserId));
    }

    const incidentNotes = [];
    for (const item of dto.incidentNotes ?? []) {
      incidentNotes.push(await this.syncIncidentNote(item, guideUserId));
    }

    return { checkIns, incidentNotes };
  }

  private async syncCheckIn(dto: FieldCheckInSyncDto, guideUserId: string) {
    const now = new Date();
    const incomingCheckedInAt = new Date(dto.checkedInAt);
    const existing = await this.prisma.fieldCheckIn.findUnique({ where: { id: dto.id } });

    if (existing) {
      // §3.2 — "poslednji upis pobeđuje po vremenskoj oznaci": samo primeni ako je pristigli
      // zapis stariji/istovetan po sadržaju NE menja ništa osim potvrde synced_at; ako se
      // sadržaj razlikuje i pristigla vremenska oznaka je NOVIJA, prepiši polja.
      const contentChanged = existing.bookingItemGuestId !== dto.bookingItemGuestId || existing.checkedInAt.getTime() !== incomingCheckedInAt.getTime();
      const shouldOverwrite = contentChanged && incomingCheckedInAt.getTime() > existing.checkedInAt.getTime();

      const updated = await this.prisma.fieldCheckIn.update({
        where: { id: dto.id },
        data: shouldOverwrite
          ? { bookingItemGuestId: dto.bookingItemGuestId, checkedInAt: incomingCheckedInAt, syncedAt: now }
          : { syncedAt: now },
      });

      await this.auditLog.write({
        actorType: 'HUMAN',
        actorId: guideUserId,
        module: 'M9',
        action: shouldOverwrite ? 'field_checkin.resynced_overwritten' : 'field_checkin.resynced_idempotent',
        resourceType: 'FieldCheckIn',
        resourceId: dto.id,
        beforeState: { checkedInAt: existing.checkedInAt, syncedAt: existing.syncedAt },
        afterState: { checkedInAt: updated.checkedInAt, syncedAt: updated.syncedAt },
        context: { conflictDetected: contentChanged },
      });

      return updated;
    }

    const created = await this.prisma.fieldCheckIn.create({
      data: {
        id: dto.id,
        bookingItemGuestId: dto.bookingItemGuestId,
        checkedInAt: incomingCheckedInAt,
        checkedInBy: guideUserId,
        syncedAt: now,
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: guideUserId,
      module: 'M9',
      action: 'field_checkin.synced',
      resourceType: 'FieldCheckIn',
      resourceId: created.id,
      afterState: created,
      context: {},
    });

    return created;
  }

  private async syncIncidentNote(dto: FieldIncidentNoteSyncDto, guideUserId: string) {
    const now = new Date();
    const incomingCreatedAt = new Date(dto.createdAt);
    const existing = await this.prisma.fieldIncidentNote.findUnique({ where: { id: dto.id } });

    let record;
    let wasAlreadySynced = false;
    if (existing) {
      wasAlreadySynced = existing.syncedAt !== null;
      const contentChanged = existing.note !== dto.note || existing.severity !== dto.severity || existing.createdAt.getTime() !== incomingCreatedAt.getTime();
      const shouldOverwrite = contentChanged && incomingCreatedAt.getTime() > existing.createdAt.getTime();

      record = await this.prisma.fieldIncidentNote.update({
        where: { id: dto.id },
        data: shouldOverwrite
          ? { bookingId: dto.bookingId, note: dto.note, severity: dto.severity, createdAt: incomingCreatedAt, syncedAt: now }
          : { syncedAt: now },
      });

      await this.auditLog.write({
        actorType: 'HUMAN',
        actorId: guideUserId,
        module: 'M9',
        action: shouldOverwrite ? 'field_incident.resynced_overwritten' : 'field_incident.resynced_idempotent',
        resourceType: 'FieldIncidentNote',
        resourceId: dto.id,
        beforeState: { note: existing.note, severity: existing.severity, syncedAt: existing.syncedAt },
        afterState: { note: record.note, severity: record.severity, syncedAt: record.syncedAt },
        context: { conflictDetected: contentChanged },
      });
    } else {
      record = await this.prisma.fieldIncidentNote.create({
        data: {
          id: dto.id,
          bookingId: dto.bookingId,
          guideId: guideUserId,
          note: dto.note,
          severity: dto.severity,
          createdAt: incomingCreatedAt,
          syncedAt: now,
        },
      });

      await this.auditLog.write({
        actorType: 'HUMAN',
        actorId: guideUserId,
        module: 'M9',
        action: 'field_incident.synced',
        resourceType: 'FieldIncidentNote',
        resourceId: record.id,
        afterState: record,
        context: {},
      });
    }

    // §3.3 — URGENT generiše ODMAH vidljivo upozorenje timu čim se sinhronizuje (isti princip
    // kao M10 neuspešno slanje fiskalnog dokumenta ka SEF/ESIR — audit log entry + Event Bus
    // signal koji budući M17/M18/M19 mogu da konzumiraju). Emituje se svaki put kad zapis PRVI
    // PUT postane synced (ne ponovo na svaki idempotentan re-sync bez promene sadržaja).
    if (record.severity === FieldIncidentSeverity.URGENT && !wasAlreadySynced) {
      await this.auditLog.write({
        actorType: 'HUMAN',
        actorId: guideUserId,
        module: 'M9',
        action: 'field_incident.urgent_alert',
        resourceType: 'FieldIncidentNote',
        resourceId: record.id,
        afterState: record,
        context: { severity: 'URGENT', bookingId: record.bookingId },
      });
      await this.eventBus.emit('M9', 'field_incident.urgent', {
        fieldIncidentNoteId: record.id,
        bookingId: record.bookingId,
        guideId: record.guideId,
        note: record.note,
      });
    }

    return record;
  }
}
