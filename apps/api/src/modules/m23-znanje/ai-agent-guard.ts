import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * M23 spec §9, izlazni kriterijum ("publish/article-source approve/article-revision approve se
 * ne mogu izvršiti nalogom actor_type=AI_AGENT — provereno na nivou koda"). Isti princip kao M21/
 * M22 (approved_by/reviewed_by mora biti popunjen ljudskim User.id) — ovde je eksplicitna, jer M23
 * ima AI agenta (KnowledgeAgent) koji SME da priprema nacrte (istraživanje/osvežavanje) preko
 * sopstvenog M1 naloga (account_type=AI_AGENT), pa se odobrenje mora sprovesti kodom, ne samo
 * pretpostavkom da JWT nalog uvek pripada čoveku.
 *
 * Baca ForbiddenException ako je `actorId` M1 User povezan sa AIAgent zapisom (account_type=AI_AGENT).
 */
export async function assertHumanActor(prisma: PrismaService, actorId: string, action: string): Promise<void> {
  const agent = await prisma.aIAgent.findUnique({ where: { userId: actorId } });
  if (agent) {
    throw new ForbiddenException(`${action} nikad ne sme izvršiti AI agent (M23 spec poglavlje 6/9) — nalog ${actorId} je AI_AGENT.`);
  }
}
