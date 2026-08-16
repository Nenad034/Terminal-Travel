import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';

// M23 spec §4c — dnevni posao (isti raspored kao M18/M21 dnevni poslovi) koji nalazi PUBLISHED
// članke sa dospelim next_refresh_due_at i priprema ArticleRevision(SCHEDULED_REFRESH,
// PENDING_REVIEW) NAD VEĆ APPROVED izvorima te niti. Ovaj prolaz nema živu web pretragu (potvrđeno
// sa vlasnikom, poglavlje "Kontekst" plana implementacije) — osvežavanje u v1 kreira PRAZAN
// "za pregled" placeholder koji čeka da zaposleni ručno dostavi ažuriran tekst (isti ulaz kao
// KnowledgeResearchService.researchFromProvidedText, samo pokrenut naknadno preko
// POST /articles/:id/sources + POST istraživanja, van obima ovog automatskog koraka).
// NE MENJA objavljen sadržaj, NE POMERA next_refresh_due_at dok revizija ne bude APPROVED
// (izlazni kriterijum §9 — testabilna stavka).
@Injectable()
export class KnowledgeRefreshService {
  private readonly logger = new Logger(KnowledgeRefreshService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runDueRefreshesCron(): Promise<number> {
    return this.runDueRefreshes();
  }

  async runDueRefreshes(): Promise<number> {
    const now = new Date();
    const dueArticles = await this.prisma.article.findMany({
      where: { status: 'PUBLISHED', nextRefreshDueAt: { lte: now } },
    });

    let created = 0;
    for (const article of dueArticles) {
      // Ne dupliraj — ako već postoji PENDING_REVIEW SCHEDULED_REFRESH revizija za ovaj članak,
      // preskoči (čeka se na postojeću odluku, isti princip kao §4c korak 3/4: "ne pomera rok dok
      // revizija ne bude odobrena", pa se ni novi placeholder ne pravi svaki dan iznova).
      const alreadyPending = await this.prisma.articleRevision.findFirst({
        where: { articleId: article.id, trigger: 'SCHEDULED_REFRESH', status: 'PENDING_REVIEW' },
      });
      if (alreadyPending) continue;

      const approvedSources = await this.prisma.articleSource.findMany({
        where: { articleId: article.id, status: 'APPROVED' },
      });

      const revision = await this.prisma.articleRevision.create({
        data: {
          articleId: article.id,
          trigger: 'SCHEDULED_REFRESH',
          // §4c — placeholder: nacrt prazan/prazan poziv na akciju dok zaposleni ne dostavi
          // ažuriran tekst (v1, nema žive pretrage). Namerno NE kopira postojeći sadržaj kao
          // "nacrt" jer bi to moglo izgledati kao da je AI već potvrdio da je sadržaj i dalje tačan
          // bez ijednog stvarnog uvida — prazan niz je iskreniji signal "čeka ljudski unos".
          proposedTranslations: [],
          sourceIds: approvedSources.map((s) => s.id),
          status: 'PENDING_REVIEW',
        },
      });

      const agent = await this.prisma.aIAgent.findFirst({ where: { agentRole: 'KNOWLEDGE_AGENT' } });
      // Deterministički kod (provera dospelog roka) — NIKAD ne zove AgentInvocationLogService
      // (isti princip kao M18 komentar uz taj servis, nijedan jezički model nije pozvan ovde).
      await this.auditLog.write({
        actorType: 'AI_AGENT',
        actorId: agent?.userId ?? null,
        module: 'M23',
        action: 'knowledge_article.scheduled_refresh_prepared',
        resourceType: 'ArticleRevision',
        resourceId: revision.id,
        afterState: { articleId: article.id, approvedSourceCount: approvedSources.length },
        context: {},
      });

      created += 1;
    }

    if (created > 0) this.logger.log(`Pripremljeno ${created} SCHEDULED_REFRESH revizija za pregled.`);
    return created;
  }
}
