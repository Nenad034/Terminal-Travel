import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { AnthropicClientService } from '../../m15-ai-orkestracija/anthropic/anthropic-client.service';
import { AgentInvocationLogService } from '../../m18-operativni-nadzor/agent-invocations/agent-invocation-log.service';
import { DraftReplyDto } from './dto/draft-reply.dto';

const MESSAGE_HISTORY_LIMIT = 20;

// M19 spec §9.5 — "AI agent sme da sažima dugu prepisku i priprema nacrt odgovora zaposlenom...
// nivo Predloži-pa-čovek-odobri". Ova klasa NIKAD ne poziva ConversationsService.createMessage —
// to je sama sprovedba pravila (nema execute putanje da izvrši, samo vraća tekst; zaposleni ga
// ručno šalje preko `message.send`, isti obrazac kao M6 CommunicationLog §4.1).
@Injectable()
export class SupplierDraftService {
  private readonly logger = new Logger(SupplierDraftService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly anthropic: AnthropicClientService,
    private readonly invocationLog: AgentInvocationLogService,
  ) {}

  async draftReply(conversationId: string, dto: DraftReplyDto, actorUserId: string): Promise<{ draft: string | null; note?: string }> {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || conversation.type !== 'EXTERNAL_SUPPLIER') {
      throw new NotFoundException(`EXTERNAL_SUPPLIER razgovor ${conversationId} nije pronađen.`);
    }
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: actorUserId } },
    });
    if (!participant) throw new ForbiddenException('Nemate pristup ovom razgovoru (SupplierConversationAccess).');

    const messages = await this.prisma.message.findMany({
      where: { conversationId, deletedAt: null },
      orderBy: { sentAt: 'desc' },
      take: MESSAGE_HISTORY_LIMIT,
    });
    const history = messages.reverse();

    if (history.length === 0) {
      return { draft: null, note: 'Nema dovoljno prepiske da AI predloži nacrt odgovora.' };
    }

    if (!this.anthropic.isConfigured()) {
      return { draft: null, note: 'AI nacrt trenutno nije dostupan (ANTHROPIC_API_KEY nije podešen na serveru).' };
    }

    try {
      return await this.generateDraft(conversationId, history, dto.instruction, actorUserId);
    } catch (err) {
      this.logger.warn(`Anthropic poziv nije uspeo: ${(err as Error).message}`);
      return { draft: null, note: 'AI nacrt trenutno nije dostupan — pokušaj ponovo kasnije.' };
    }
  }

  private async generateDraft(
    conversationId: string,
    history: { senderId: string; body: string }[],
    instruction: string | undefined,
    actorUserId: string,
  ): Promise<{ draft: string }> {
    const client = this.anthropic.getClient();
    const senderIds = [...new Set(history.map((m) => m.senderId))];
    const senders = await this.prisma.user.findMany({ where: { id: { in: senderIds } } });
    const transcript = history
      .map((m) => {
        const sender = senders.find((s) => s.id === m.senderId);
        return `${sender?.fullName ?? m.senderId}: ${m.body}`;
      })
      .join('\n');

    const systemPrompt =
      'Ti si SupplierDraftAgent za internu komunikacionu platformu agencije Terminal Travel. Sažimaš prepisku sa ' +
      'dobavljačem i predlažeš nacrt sledećeg odgovora zaposlenom, na srpskom. Ti NIKAD ne šalješ poruku — samo ' +
      'predlažeš tekst koji zaposleni ručno pregleda i pošalje. Ako nacrt pominje cenu ili obavezu, jasno na kraju ' +
      'napomeni "Proveri cenu/obavezu pre slanja" — potvrda ostaje na zaposlenom, ne na tebi. Ne izmišljaj podatke ' +
      'koji nisu u prepisci.';

    const userPrompt = instruction
      ? `Prepiska:\n${transcript}\n\nUputstvo zaposlenog za odgovor: ${instruction}`
      : `Prepiska:\n${transcript}\n\nPredloži kratak, profesionalan nacrt sledećeg odgovora dobavljaču.`;

    const startedAt = Date.now();
    const response = await client.messages.create({
      model: AnthropicClientService.MODEL,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const textBlock = response.content.find((b: any) => b.type === 'text') as { text: string } | undefined;
    const draft = textBlock?.text ?? '';

    const agent = await this.prisma.aIAgent.findFirst({ where: { agentRole: 'SUPPLIER_DRAFT_AGENT' } });
    if (agent) {
      await this.invocationLog.record({
        agentId: agent.id,
        actionCode: 'supplier_draft.generate',
        requestedTier: agent.modelTier ?? 'LIGHT',
        securityCritical: false,
        modelIdentifier: AnthropicClientService.MODEL,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        latencyMs: Date.now() - startedAt,
      });
    }

    await this.auditLog.write({
      actorType: 'AI_AGENT',
      actorId: agent?.userId ?? null,
      module: 'M19',
      action: 'supplier_draft.generate',
      resourceType: 'Conversation',
      resourceId: conversationId,
      context: { requestedBy: actorUserId, hasInstruction: Boolean(instruction) },
    });

    return { draft };
  }
}
