import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventBusService } from '../../../common/events/event-bus.service';
import { resolveCallerIdentity } from '../../../common/auth/resolve-caller-identity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';

const ZZP_RESPONSE_DAYS = 8; // §3.1 — zakonski rok odgovora na reklamaciju (Zakon o zaštiti potrošača)

interface OwnershipContext {
  /** true za GUEST i SUBAGENT_CONTACT pozivaoce — vidljivost/kreiranje ograničeno na sopstveno. */
  isRestricted: boolean;
  /** M6 ClientAccount.id koji odgovara pozivaocu (za subagenta, izvedeno iz Subagent.client_account_id). */
  ownAccountId: string | null;
}

// M14 spec §2/§3/§4/§5/§6 — tiketing za goste (M8/M9) i subagente (M7), sa zakonskim rokom
// reklamacije (§3.1) i AI-nacrt tokom istim obrascem kao M6 CommunicationLog (§4).
@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  // §5 — Gost (accountType GUEST) i SUBAGENT_ADMIN (accountType SUBAGENT_CONTACT) vide/kreiraju
  // isključivo sopstvene tikete na nivou API-ja (obim nije zaseban ključ dozvole, sprovodi se
  // ovde). Interni tim (nema linked_profile_id koji vodi ka ClientAccount preko ova dva puta)
  // nije ograničen.
  private async resolveOwnershipContext(actorUserId: string | undefined): Promise<OwnershipContext> {
    if (!actorUserId) return { isRestricted: false, ownAccountId: null };
    const identity = await resolveCallerIdentity(this.prisma, actorUserId);

    if (identity.accountType === 'GUEST') {
      return { isRestricted: true, ownAccountId: identity.ownProfileId };
    }
    if (identity.accountType === 'SUBAGENT_CONTACT' && identity.ownProfileId) {
      const subagent = await this.prisma.subagent.findUnique({ where: { id: identity.ownProfileId } });
      return { isRestricted: true, ownAccountId: subagent?.clientAccountId ?? null };
    }
    return { isRestricted: false, ownAccountId: null };
  }

  private async nextTicketNumber(): Promise<string> {
    const year = new Date().getFullYear();
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.prisma.ticket.count({ where: { ticketNumber: { startsWith: `HD-${year}-` } } });
      const candidate = `HD-${year}-${String(count + 1 + attempt).padStart(6, '0')}`;
      const exists = await this.prisma.ticket.findUnique({ where: { ticketNumber: candidate } });
      if (!exists) return candidate;
    }
    throw new BadRequestException('Nije moguće generisati jedinstven ticket_number, pokušajte ponovo.');
  }

  // §6 — GET /tickets. Gost/SUBAGENT_ADMIN vide isključivo sopstvene tikete (requester_client_
  // account_id == ownAccountId); interni tim (M14/ticket/VIEW) vidi sve.
  async findMany(actorUserId?: string) {
    const ownership = await this.resolveOwnershipContext(actorUserId);
    if (ownership.isRestricted) {
      if (!ownership.ownAccountId) return [];
      return this.prisma.ticket.findMany({
        where: { requesterClientAccountId: ownership.ownAccountId },
        orderBy: { createdAt: 'desc' },
      });
    }
    return this.prisma.ticket.findMany({ orderBy: { createdAt: 'desc' } });
  }

  // §7 — tiket vezan za rezervaciju prikazuje kontekst iz M5 uživo (bookingNumber/status), bez
  // dupliranja u Ticket samom.
  async findOne(id: string, actorUserId?: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException(`Ticket ${id} nije pronađen.`);

    const ownership = await this.resolveOwnershipContext(actorUserId);
    if (ownership.isRestricted && ticket.requesterClientAccountId !== ownership.ownAccountId) {
      throw new NotFoundException(`Ticket ${id} nije pronađen.`);
    }

    let relatedBooking: { id: string; bookingNumber: string; status: string } | null = null;
    if (ticket.relatedBookingId) {
      const booking = await this.prisma.booking.findUnique({ where: { id: ticket.relatedBookingId } });
      if (booking) relatedBooking = { id: booking.id, bookingNumber: booking.bookingNumber, status: booking.status };
    }

    return { ...ticket, relatedBooking };
  }

  async create(dto: CreateTicketDto, actorUserId?: string) {
    const ownership = await this.resolveOwnershipContext(actorUserId);

    // §5 — Gost/SUBAGENT_ADMIN ne mogu kreirati tiket u ime nekog drugog: requester_client_
    // account_id se uvek prepisuje na sopstveni nalog, šta god je prosleđeno u telu zahteva.
    let requesterClientAccountId = dto.requesterClientAccountId ?? null;
    if (ownership.isRestricted) {
      if (!ownership.ownAccountId) {
        throw new ForbiddenException('Nalog pozivaoca nije povezan ni sa jednim ClientAccount profilom.');
      }
      requesterClientAccountId = ownership.ownAccountId;
    }

    const ticketNumber = await this.nextTicketNumber();
    const isReklamacija = dto.category === 'REKLAMACIJA';
    const now = new Date();

    const ticket = await this.prisma.ticket.create({
      data: {
        ticketNumber,
        requesterClientAccountId,
        requesterType: dto.requesterType,
        relatedBookingId: dto.relatedBookingId ?? null,
        subject: dto.subject,
        category: dto.category,
        priority: dto.priority ?? 'NORMAL',
        status: 'OPEN',
        channel: dto.channel,
        sourceEmailThreadId: dto.sourceEmailThreadId ?? null,
        // §3.1 — zakonski rok se popunjava automatski, samo za REKLAMACIJA.
        zzpResponseDeadline: isReklamacija ? addDays(now, ZZP_RESPONSE_DAYS) : null,
      },
    });

    return ticket;
  }

  // §6 — PATCH /tickets/:id, isključivo interni tim (M14/ticket/RESPOND, kontroler).
  // refund_decision=true uz status=RESOLVED zatvara §8 otvoreno pitanje (§3.2): emituje
  // ticket.resolved_with_refund preko Event Bus-a, M10 se pretplaćuje i priprema DRAFT storno.
  async update(id: string, dto: UpdateTicketDto, actorUserId?: string) {
    const existing = await this.findOne(id, actorUserId);

    const becomesResolved = dto.status === 'RESOLVED' && existing.status !== 'RESOLVED';
    const refundDecision = dto.refundDecision ?? existing.refundDecision;

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: dto.status,
        priority: dto.priority,
        assignedTo: dto.assignedTo,
        refundDecision: dto.refundDecision,
        resolvedAt: becomesResolved ? new Date() : undefined,
      },
    });

    // §3.2 — emituje se samo na TRANZICIJI u RESOLVED sa refund_decision=true (ne na svaki PATCH
    // koji dodirne već rešen tiket), da M10 ne pripremi duplikat nacrta pri svakoj izmeni.
    if (becomesResolved && refundDecision) {
      await this.eventBus.emit('M14', 'ticket.resolved_with_refund', {
        ticketId: updated.id,
        relatedBookingId: updated.relatedBookingId,
      });
    }

    return updated;
  }

  // §6 — GET /tickets/:id/messages. Interne beleške (is_internal_note=true) se filtriraju za
  // Gost/SUBAGENT_ADMIN (§5) — nikad vidljive van internog panela, bez obzira što imaju VIEW
  // nad samim tiketom.
  async findMessages(ticketId: string, actorUserId?: string) {
    const ownership = await this.resolveOwnershipContext(actorUserId);
    await this.findOne(ticketId, actorUserId); // 404 + ownership provera nad samim tiketom

    const messages = await this.prisma.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });

    if (!ownership.isRestricted) return messages;
    return messages.filter((m) => !m.isInternalNote);
  }

  // §4/§6 — POST /tickets/:id/messages. Gost/SUBAGENT_ADMIN smeju samo senderType=REQUESTER na
  // sopstvenom tiketu (sprovedeno kroz kombinaciju CREATE dozvole + ownership provera ovde —
  // RESPOND dozvola, koju oni nemaju, štiti STAFF/AI_DRAFT poruke i interne beleške).
  async createMessage(ticketId: string, dto: CreateTicketMessageDto, actorUserId?: string) {
    const ownership = await this.resolveOwnershipContext(actorUserId);
    await this.findOne(ticketId, actorUserId); // 404 + ownership provera

    if (ownership.isRestricted && dto.senderType !== 'REQUESTER') {
      throw new ForbiddenException('Gost/subagent može dodati isključivo poruku tipa REQUESTER.');
    }
    if (ownership.isRestricted && dto.isInternalNote) {
      throw new ForbiddenException('Gost/subagent ne može kreirati internu belešku.');
    }

    // §4 — AI_DRAFT nikad ne dobija sent_by pri kreiranju, bez obzira ko poziva. STAFF poruka
    // kreirana kroz ovaj (već autentikovan, ljudski) poziv se smatra odmah poslatom.
    const sentBy = dto.senderType === 'STAFF' ? (actorUserId ?? null) : null;

    return this.prisma.ticketMessage.create({
      data: {
        ticketId,
        senderType: dto.senderType,
        senderId: dto.senderId ?? actorUserId ?? null,
        body: dto.body,
        isInternalNote: dto.isInternalNote ?? false,
        sentBy,
      },
    });
  }

  // §4 — POST /tickets/:id/messages/:messageId/send. Jedini put kroz koji AI_DRAFT poruka
  // dobija sent_by — uvek ljudski nalog (kontroler štiti sa M14/ticket/RESPOND).
  async sendMessage(ticketId: string, messageId: string, actor: { userId: string }) {
    const message = await this.prisma.ticketMessage.findUnique({ where: { id: messageId } });
    if (!message || message.ticketId !== ticketId) throw new NotFoundException(`Poruka ${messageId} nije pronađena na tiketu ${ticketId}.`);
    if (message.sentBy) throw new BadRequestException(`Poruka ${messageId} je već poslata.`);

    return this.prisma.ticketMessage.update({ where: { id: messageId }, data: { sentBy: actor.userId } });
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
