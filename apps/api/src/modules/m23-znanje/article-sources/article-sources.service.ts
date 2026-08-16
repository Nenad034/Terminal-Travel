import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { ProposeSourceDto } from './dto/propose-source.dto';
import { assertHumanActor } from '../ai-agent-guard';

// M23 spec §2.3/§4b — CANDIDATE dok čovek ne odobri; approve/reject nikad AI (provereno na nivou
// koda, ne samo dozvole — poglavlje 9 izlazni kriterijum).
@Injectable()
export class ArticleSourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll(articleId: string) {
    await this.assertArticleExists(articleId);
    return this.prisma.articleSource.findMany({ where: { articleId }, orderBy: { createdAt: 'desc' } });
  }

  async propose(articleId: string, dto: ProposeSourceDto, actorId: string) {
    await this.assertArticleExists(articleId);
    const source = await this.prisma.articleSource.create({
      data: { articleId, url: dto.url, sourceType: dto.sourceType, status: 'CANDIDATE' },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M23',
      action: 'article_source.proposed',
      resourceType: 'ArticleSource',
      resourceId: source.id,
      afterState: source,
      context: { articleId },
    });
    return source;
  }

  async approve(articleId: string, sourceId: string, actorId: string) {
    await assertHumanActor(this.prisma, actorId, 'Odobrenje izvora (M23/article-source/APPROVE)');
    const source = await this.prisma.articleSource.findUnique({ where: { id: sourceId } });
    if (!source || source.articleId !== articleId) throw new NotFoundException(`ArticleSource ${sourceId} nije pronađen za članak ${articleId}.`);

    const updated = await this.prisma.articleSource.update({
      where: { id: sourceId },
      data: { status: 'APPROVED', approvedBy: actorId, approvedAt: new Date() },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M23',
      action: 'article_source.approved',
      resourceType: 'ArticleSource',
      resourceId: sourceId,
      beforeState: source,
      afterState: updated,
      context: { articleId },
    });
    return updated;
  }

  async reject(articleId: string, sourceId: string, actorId: string) {
    await assertHumanActor(this.prisma, actorId, 'Odbijanje izvora (M23/article-source/APPROVE)');
    const source = await this.prisma.articleSource.findUnique({ where: { id: sourceId } });
    if (!source || source.articleId !== articleId) throw new NotFoundException(`ArticleSource ${sourceId} nije pronađen za članak ${articleId}.`);

    const updated = await this.prisma.articleSource.update({ where: { id: sourceId }, data: { status: 'REJECTED' } });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M23',
      action: 'article_source.rejected',
      resourceType: 'ArticleSource',
      resourceId: sourceId,
      beforeState: source,
      afterState: updated,
      context: { articleId },
    });
    return updated;
  }

  private async assertArticleExists(articleId: string) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException(`Article ${articleId} nije pronađen.`);
  }
}
