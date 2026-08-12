import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { GoogleReviewConfigService } from './google-review-config';
import { SubmitPostTripSurveyDto } from './dto/submit-post-trip-survey.dto';

const SURVEY_SEND_DELAY_DAYS = 2; // §4.3 — T+2 dana posle povratka

@Injectable()
export class PostTripSurveysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewConfig: GoogleReviewConfigService,
  ) {}

  async findMany(filter: { bookingId?: string; status?: string }) {
    return this.prisma.postTripSurvey.findMany({
      where: { bookingId: filter.bookingId, status: filter.status as any },
      orderBy: { createdAt: 'desc' },
    });
  }

  // §4.3 — poziva se iz M6EventSubscribersService na booking.completed. Idempotentno.
  async createForBooking(bookingId: string): Promise<void> {
    const existing = await this.prisma.postTripSurvey.findUnique({ where: { bookingId } });
    if (existing) return;

    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return;

    await this.prisma.postTripSurvey.create({
      data: {
        bookingId,
        clientAccountId: booking.clientAccountId,
        accessToken: randomBytes(24).toString('hex'),
        status: 'PENDING',
        scheduledSendAt: new Date(Date.now() + SURVEY_SEND_DELAY_DAYS * 24 * 60 * 60 * 1000),
      },
    });
  }

  // §9 — GET /post-trip-surveys/:token, javni pristup preko tokena umesto autentikacije.
  async findByToken(token: string) {
    const survey = await this.prisma.postTripSurvey.findUnique({ where: { accessToken: token } });
    if (!survey) throw new NotFoundException('Anketa nije pronađena.');
    return survey;
  }

  // §9 — POST /post-trip-surveys/:token/submit, javni pristup.
  async submit(token: string, dto: SubmitPostTripSurveyDto) {
    const survey = await this.findByToken(token);
    if (survey.status === 'COMPLETED') {
      throw new BadRequestException('Anketa je već popunjena.');
    }

    const { ratingThreshold } = this.reviewConfig.get();
    return this.prisma.postTripSurvey.update({
      where: { id: survey.id },
      data: {
        status: 'COMPLETED',
        responses: dto.responses as any,
        overallRating: dto.overallRating,
        wantsGoogleReview: dto.overallRating >= ratingThreshold,
        completedAt: new Date(),
      },
    });
  }

  // §9 — POST /post-trip-surveys/:token/google-review-click, javni pristup, beleži klik pre
  // redirekta na Google link (izgled/URL isporučuje front-end preko GET /post-trip-surveys/:token).
  async recordGoogleReviewClick(token: string) {
    const survey = await this.findByToken(token);
    await this.prisma.postTripSurvey.update({
      where: { id: survey.id },
      data: { googleReviewClickedAt: new Date() },
    });
    return { googleReviewUrl: this.reviewConfig.get().url };
  }

  // Deo dnevnog periodičnog posla (§4.3 — "email se automatski šalje samo ako je
  // marketing_consent = true, inače čeka ljudsko slanje" preko CommunicationLog §4.1).
  async sendDueSurveys(): Promise<{ sent: number; awaitingHuman: number }> {
    const due = await this.prisma.postTripSurvey.findMany({
      where: { status: 'PENDING', scheduledSendAt: { lte: new Date() } },
    });

    let sent = 0;
    let awaitingHuman = 0;
    for (const survey of due) {
      // clientAccountId je slaba referenca (bez DB FK, vidi napomenu u schema.prisma) — čita se
      // uživo, izostanak ClientAccount zapisa tretira se kao "nema saglasnosti".
      const account = await this.prisma.clientAccount.findUnique({ where: { id: survey.clientAccountId } });
      if (account?.marketingConsent) {
        await this.prisma.postTripSurvey.update({
          where: { id: survey.id },
          data: { status: 'SENT', sentAt: new Date() },
        });
        // §4.1 dopuna — automatski "poslat" zapis (bez ljudskog pregleda, čisto informativan
        // sadržaj), sentBy = 'SYSTEM_AUTO' jer nijedan ljudski nalog nije izvršio slanje (isti
        // obrazac kao Booking.created_by = 'GOST_SELF'), NE ide kroz CommunicationLogService.create
        // (koja uvek prisilno postavlja sent_by=null za draftedByAi=true, pravilo za §4.1 ručni tok).
        await this.prisma.communicationLog.create({
          data: {
            clientAccountId: survey.clientAccountId,
            channel: 'EMAIL',
            direction: 'OUTBOUND',
            summary: `Anketa o zadovoljstvu posle putovanja (rezervacija ${survey.bookingId}) — automatski poslata.`,
            draftedByAi: true,
            sentBy: 'SYSTEM_AUTO',
          },
        });
        sent++;
      } else {
        await this.prisma.communicationLog.create({
          data: {
            clientAccountId: survey.clientAccountId,
            channel: 'EMAIL',
            direction: 'OUTBOUND',
            summary: `Anketa o zadovoljstvu posle putovanja (rezervacija ${survey.bookingId}) — nacrt, čeka ljudsko slanje (bez marketing_consent).`,
            draftedByAi: true,
            sentBy: null,
          },
        });
        awaitingHuman++;
      }
    }
    return { sent, awaitingHuman };
  }
}
