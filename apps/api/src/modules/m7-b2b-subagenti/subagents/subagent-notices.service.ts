import { BadRequestException, Injectable } from '@nestjs/common';
import { B2bAudience } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { SubagentsService } from './subagents.service';

/** M7 spec §11 `GET /b2b/notice-recipients` — ono što M12 adapter treba da pošalje obaveštenje. */
export interface NoticeRecipient {
  subagentId: string;
  clientAccountId: string;
  name: string;
  email: string | null;
  offerNoticesByEmail: boolean;
}

/**
 * M7 spec §5b (v1.13/v1.14) — obaveštenje subagentima o akciji pred istek. Prvi kanal kojim
 * agencija nešto ŠALJE subagentu. M7 daje dve stvari: spisak primalaca (5b.1) i mesto na
 * portalu gde obaveštenje stoji (5b.2, `SubagentNotice`). Sam sadržaj, odobrenje i slanje su
 * posao M12 (`B2B_SUBAGENTS` adapter).
 */
@Injectable()
export class SubagentNoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subagents: SubagentsService,
  ) {}

  /**
   * §5b.1 — dva kruga. `SUSPENDED` i `PENDING_APPROVAL` nikad ne dobijaju. Proizvod mora biti
   * vidljiv na portalu (`visible_channels` sadrži `B2B_PORTAL`, M2 §5) — bez toga subagent ne bi
   * imao šta da klikne.
   *
   * `ASSIGNED_ONLY` danas daje ISTI skup kao `ALL_ACTIVE`: M7 §5a `SubagentCapacityAllocation`
   * je specifikacija bez tabele (17.9.2026), pa „nemaju nijednu dodelu uopšte" važi za svakog
   * subagenta — a takav, po 5a.2, vidi punu raspoloživost i po pravilu 5b.1 ulazi u krug. Kad
   * dodele dobiju kod, ovde se dodaje presek sa njima; potpis metode ostaje isti.
   */
  async findRecipients(productId: string, audience: B2bAudience): Promise<NoticeRecipient[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, visibleChannels: true },
    });
    if (!product) throw new BadRequestException(`Proizvod ${productId} ne postoji.`);
    if (!product.visibleChannels.includes('B2B_PORTAL')) return [];

    void audience; // vidi komentar iznad — razlika između krugova čeka §5a tabelu
    const rows = await this.prisma.subagent.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, clientAccountId: true, offerNoticesByEmail: true },
      orderBy: { createdAt: 'asc' },
    });
    // `Subagent.clientAccountId` je slaba veza (bez Prisma relacije) — isti način čitanja kao
    // `SubagentsService.create` (§2.1: subagent je ClientAccount tipa LEGAL_ENTITY).
    const accounts = await this.prisma.clientAccount.findMany({
      where: { id: { in: rows.map((r) => r.clientAccountId) } },
      select: { id: true, email: true, companyName: true, fullName: true },
    });
    const byId = new Map(accounts.map((a) => [a.id, a]));
    return rows.map((r) => {
      const a = byId.get(r.clientAccountId);
      return {
        subagentId: r.id,
        clientAccountId: r.clientAccountId,
        name: a?.companyName ?? a?.fullName ?? r.clientAccountId,
        email: a?.email ?? null,
        offerNoticesByEmail: r.offerNoticesByEmail,
      };
    });
  }

  /**
   * §5b.2 — upis obaveštenja na portal, jedan red po (sadržaj, subagent). Idempotentno: ponovljen
   * poziv (cron ponovo pokušao objavu) ne pravi drugi red niti briše `readAt`.
   */
  async deliver(
    contentPieceId: string,
    deliveries: { subagentId: string; emailedAt: Date | null }[],
  ): Promise<number> {
    let created = 0;
    for (const d of deliveries) {
      const existing = await this.prisma.subagentNotice.findUnique({
        where: { contentPieceId_subagentId: { contentPieceId, subagentId: d.subagentId } },
        select: { id: true, emailedAt: true },
      });
      if (existing) {
        if (!existing.emailedAt && d.emailedAt) {
          await this.prisma.subagentNotice.update({
            where: { id: existing.id },
            data: { emailedAt: d.emailedAt },
          });
        }
        continue;
      }
      await this.prisma.subagentNotice.create({
        data: { contentPieceId, subagentId: d.subagentId, emailedAt: d.emailedAt },
      });
      created++;
    }
    return created;
  }

  /**
   * `GET /b2b/notices` — objavljena obaveštenja za prijavljenog subagenta, najnovije prvo. Ona
   * kojima je `offerBookingTo` prošao ostaju u istoriji, ali idu iza aktivnih (§5b.2 „nestaje sa
   * vrha"). Osoblje sme da pogleda tuđ spisak preko `subagentId` (za proveru šta je partner dobio).
   */
  async listForCaller(actorUserId: string, opts: { unread?: boolean; subagentId?: string }) {
    const subagentId = await this.resolveSubagentId(actorUserId, opts.subagentId);
    const today = new Date(new Date().toISOString().slice(0, 10));
    const rows = await this.prisma.subagentNotice.findMany({
      where: {
        subagentId,
        readAt: opts.unread ? null : undefined,
        contentPiece: { status: 'PUBLISHED' },
      },
      include: {
        contentPiece: {
          select: {
            id: true,
            productId: true,
            offerBookingTo: true,
            publishedAt: true,
            translations: {
              select: { languageCode: true, title: true, body: true },
            },
          },
        },
      },
      orderBy: { deliveredAt: 'desc' },
      take: 100,
    });
    const items = rows.map((r) => {
      const t =
        r.contentPiece.translations.find((x) => x.languageCode === 'sr') ??
        r.contentPiece.translations[0] ??
        null;
      const expired =
        r.contentPiece.offerBookingTo !== null && r.contentPiece.offerBookingTo < today;
      return {
        contentId: r.contentPiece.id,
        productId: r.contentPiece.productId,
        title: t?.title ?? '',
        body: t?.body ?? '',
        offerBookingTo: r.contentPiece.offerBookingTo,
        publishedAt: r.contentPiece.publishedAt,
        deliveredAt: r.deliveredAt,
        readAt: r.readAt,
        expired,
      };
    });
    // Aktivne prvo, pa istekle — unutar svake grupe najnovije prvo (redosled iz upita).
    items.sort((a, b) => Number(a.expired) - Number(b.expired));
    return { subagentId, unreadCount: items.filter((i) => !i.readAt).length, items };
  }

  /** `POST /b2b/notices/:contentId/read` — brojač u gornjoj traci portala. */
  async markRead(actorUserId: string, contentPieceId: string, subagentIdOverride?: string) {
    const subagentId = await this.resolveSubagentId(actorUserId, subagentIdOverride);
    const notice = await this.prisma.subagentNotice.findUnique({
      where: { contentPieceId_subagentId: { contentPieceId, subagentId } },
    });
    if (!notice) throw new BadRequestException('Obaveštenje nije upućeno ovom subagentu.');
    if (notice.readAt) return notice;
    return this.prisma.subagentNotice.update({
      where: { id: notice.id },
      data: { readAt: new Date() },
    });
  }

  private async resolveSubagentId(actorUserId: string, override?: string): Promise<string> {
    const ctx = await this.subagents.resolveCallerContext(actorUserId);
    if (!ctx.isStaff) {
      if (override && override !== ctx.ownSubagentId) {
        throw new BadRequestException('Subagent vidi samo sopstvena obaveštenja.');
      }
      return ctx.ownSubagentId as string;
    }
    if (!override) {
      throw new BadRequestException(
        'Osoblje mora navesti subagentId — ovaj spisak pripada konkretnom subagentu.',
      );
    }
    return override;
  }
}
