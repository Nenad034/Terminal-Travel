import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { assertHumanActor } from '../ai-agent-guard';

const REFRESH_INTERVAL_DAYS = 30;

interface ProposedTranslation {
  languageCode: string;
  title: string;
  body: string;
  translationSource: 'MANUAL' | 'AI_GENERATED';
}

// M23 spec §2.4/§4c/§9 — odobrenje upisuje proposed_translations kao stvarne ArticleTranslation
// redove, pomera last_refreshed_at/next_refresh_due_at; odbijanje NE menja ništa na Article
// (testabilna izlazna kriterijum stavka). Nikad AI (provereno na nivou koda).
@Injectable()
export class ArticleRevisionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll(articleId: string) {
    return this.prisma.articleRevision.findMany({ where: { articleId }, orderBy: { createdAt: 'desc' } });
  }

  async approve(articleId: string, revisionId: string, actorId: string) {
    await assertHumanActor(this.prisma, actorId, 'Odobrenje revizije (M23/article-revision/APPROVE)');

    const revision = await this.prisma.articleRevision.findUnique({ where: { id: revisionId } });
    if (!revision || revision.articleId !== articleId) {
      throw new NotFoundException(`ArticleRevision ${revisionId} nije pronađena za članak ${articleId}.`);
    }
    if (revision.status !== 'PENDING_REVIEW') {
      throw new BadRequestException(`Revizija je već ${revision.status} — ne može se ponovo odobriti.`);
    }

    // M23 spec §9, izlazni kriterijum — revizija se NE MOŽE odobriti dok bar jedan referenciran
    // ArticleSource nije APPROVED ljudskim nalogom.
    if (revision.sourceIds.length > 0) {
      const sources = await this.prisma.articleSource.findMany({ where: { id: { in: revision.sourceIds } } });
      const notApproved = sources.filter((s) => s.status !== 'APPROVED');
      if (notApproved.length > 0 || sources.length !== revision.sourceIds.length) {
        throw new BadRequestException(
          'Revizija referencira izvor(e) koji nisu APPROVED — odobri sve izvore pre odobrenja revizije (M23 spec §4b/§9).',
        );
      }
    }

    const proposed = (revision.proposedTranslations as unknown as ProposedTranslation[]) ?? [];
    for (const t of proposed) {
      await this.prisma.articleTranslation.upsert({
        where: { articleId_languageCode: { articleId, languageCode: t.languageCode as any } },
        create: {
          articleId,
          languageCode: t.languageCode as any,
          title: t.title,
          body: t.body,
          translationSource: t.translationSource ?? 'AI_GENERATED',
        },
        update: { title: t.title, body: t.body, translationSource: t.translationSource ?? 'AI_GENERATED' },
      });
    }

    const now = new Date();
    const nextRefreshDueAt = new Date(now.getTime() + REFRESH_INTERVAL_DAYS * 24 * 60 * 60 * 1000);

    const [updatedRevision] = await this.prisma.$transaction([
      this.prisma.articleRevision.update({
        where: { id: revisionId },
        data: { status: 'APPROVED', reviewedBy: actorId, reviewedAt: now },
      }),
      this.prisma.article.update({
        where: { id: articleId },
        data: { lastRefreshedAt: now, nextRefreshDueAt },
      }),
    ]);

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M23',
      action: 'article_revision.approved',
      resourceType: 'ArticleRevision',
      resourceId: revisionId,
      beforeState: revision,
      afterState: updatedRevision,
      context: { articleId, translationsApplied: proposed.length, nextRefreshDueAt },
    });

    return updatedRevision;
  }

  async reject(articleId: string, revisionId: string, actorId: string) {
    await assertHumanActor(this.prisma, actorId, 'Odbijanje revizije (M23/article-revision/APPROVE)');

    const revision = await this.prisma.articleRevision.findUnique({ where: { id: revisionId } });
    if (!revision || revision.articleId !== articleId) {
      throw new NotFoundException(`ArticleRevision ${revisionId} nije pronađena za članak ${articleId}.`);
    }
    if (revision.status !== 'PENDING_REVIEW') {
      throw new BadRequestException(`Revizija je već ${revision.status}.`);
    }

    // §2.4/§4c — odbijanje NE MENJA ništa na Article (nema dodira lastRefreshedAt/nextRefreshDueAt).
    const updated = await this.prisma.articleRevision.update({
      where: { id: revisionId },
      data: { status: 'REJECTED', reviewedBy: actorId, reviewedAt: new Date() },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M23',
      action: 'article_revision.rejected',
      resourceType: 'ArticleRevision',
      resourceId: revisionId,
      beforeState: revision,
      afterState: updated,
      context: { articleId },
    });

    return updated;
  }
}
