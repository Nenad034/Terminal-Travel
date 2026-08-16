import { Injectable, Logger } from '@nestjs/common';
import { EmailMessage } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { AnthropicClientService } from '../../m15-ai-orkestracija/anthropic/anthropic-client.service';
import { AgentInvocationLogService } from '../../m18-operativni-nadzor/agent-invocations/agent-invocation-log.service';

// M22 spec §4 — na svaku novu INBOUND poruku, AI agent sme samostalno (nivo "Autonomno") da
// sažme sadržaj (ai_summary) i pripremi nacrt odgovora (EmailMessage senderType=AI_DRAFT,
// sentBy=null). Isti dvostepeni obrazac kao M14 §4 i M19 SupplierDraftService — graceful
// degradation kad ANTHROPIC_API_KEY nije podešen (samo sirova poruka, bez sažetka/nacrta).
//
// KLJUČNA OGRADA (§4, druga stavka): nacrt koji pominje cenu/obavezu/promenu rezervacije NE SME
// biti poslat dok ga čovek ne pregleda. Ovo je odbrambeni sloj NA NIVOU KODA, ne samo prompt —
// keyword-heuristika ispod (isti princip kao M19 SupplierDraftService/M21 HelpAssistantService
// strukturna ograda) sprovodi se BEZ OBZIRA šta model vrati, jer se AI_DRAFT poruka uvek kreira
// sa sentBy=null (TicketMessage/EmailMessage §4 obrazac) — jedini put ka sentBy je ljudski klik
// na POST /threads/:id/messages/:messageId/send (email-threads.service.ts). Ova heuristika samo
// dodatno kontroliše KOJI TEKST agent uopšte predloži, ne sprovodi samo "sme poslati" gejt (taj
// gejt je već strukturno zatvoren time što AI_DRAFT nikad ne dobija sent_by pri kreiranju).
const SENSITIVE_KEYWORDS = [
  'cena',
  'cenu',
  'cenom',
  'plaćanje',
  'plaćanja',
  'uplat',
  'refundacij',
  'povraćaj',
  'storno',
  'otkaz',
  'promen',
  'rezervacij',
  'obaveza',
  'obavezu',
  'popust',
  'eur',
  'rsd',
  'din.',
];

interface AssistResult {
  aiSummary: string | null;
  draftBody: string | null;
  containsSensitiveTopic: boolean;
}

@Injectable()
export class EmailAiAssistantService {
  private readonly logger = new Logger(EmailAiAssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly anthropic: AnthropicClientService,
    private readonly invocationLog: AgentInvocationLogService,
  ) {}

  /**
   * Poziva se odmah posle upisa nove INBOUND EmailMessage (EmailThreadsService.receiveInboundMessage).
   * Upisuje ai_summary na prosleđenu poruku i kreira posebnu AI_DRAFT poruku (sentBy=null) u istoj
   * niti — čisto informativna priprema, bez ljudske intervencije (§4/§9 izlazni kriterijum).
   */
  async processInboundMessage(message: EmailMessage): Promise<void> {
    const result = await this.buildAssistance(message.body);

    if (result.aiSummary) {
      await this.prisma.emailMessage.update({ where: { id: message.id }, data: { aiSummary: result.aiSummary } });
    }

    if (result.draftBody) {
      await this.prisma.emailMessage.create({
        data: {
          threadId: message.threadId,
          direction: 'OUTBOUND',
          senderType: 'AI_DRAFT',
          fromAddress: message.toAddresses[0] ?? '',
          toAddresses: [message.fromAddress],
          body: result.containsSensitiveTopic
            ? `${result.draftBody}\n\n[Napomena AI agenta: ovaj nacrt pominje cenu/obavezu/promenu rezervacije — proveri pre slanja.]`
            : result.draftBody,
          sentBy: null, // §4 — AI_DRAFT NIKAD ne dobija sent_by pri kreiranju, bez obzira na sadržaj
        },
      });
    }

    const agent = await this.prisma.aIAgent.findFirst({ where: { agentRole: 'EMAIL_INBOX_AGENT' } });
    await this.auditLog.write({
      actorType: 'AI_AGENT',
      actorId: agent?.userId ?? null,
      module: 'M22',
      action: 'email.summarize-draft',
      resourceType: 'EmailMessage',
      resourceId: message.id,
      context: { threadId: message.threadId, containsSensitiveTopic: result.containsSensitiveTopic },
    });
  }

  private async buildAssistance(inboundBody: string): Promise<AssistResult> {
    const containsSensitiveTopic = SENSITIVE_KEYWORDS.some((kw) => inboundBody.toLowerCase().includes(kw));

    if (!this.anthropic.isConfigured()) {
      return { aiSummary: null, draftBody: null, containsSensitiveTopic };
    }

    try {
      return await this.generateWithAnthropic(inboundBody, containsSensitiveTopic);
    } catch (err) {
      this.logger.warn(`Anthropic poziv nije uspeo: ${(err as Error).message}`);
      return { aiSummary: null, draftBody: null, containsSensitiveTopic };
    }
  }

  private async generateWithAnthropic(inboundBody: string, containsSensitiveTopic: boolean): Promise<AssistResult> {
    const client = this.anthropic.getClient();

    // §4 — sistemski prompt eksplicitno instruira model da NIKAD ne formuliše nacrt kao
    // spreman-za-slanje ako pominje cenu/obavezu/promenu rezervacije. Prompt-nivo instrukcija
    // NIJE jedina zaštita — keyword-heuristika iznad (containsSensitiveTopic) sprovodi se bez
    // obzira šta model vrati, isti dvoslojni princip kao M21 HelpAssistantService.
    const systemPrompt =
      'Ti si EmailInboxAgent za centralizovani email klijent agencije Terminal Travel. Za svaku dolaznu poruku ' +
      'radiš dve stvari, na srpskom: (1) kratak sažetak (2-3 rečenice) i (2) nacrt odgovora. Nacrt NIKAD ne sme ' +
      'delovati kao gotov, spreman-za-slanje odgovor ako pominje cenu, uplatu, popust, otkazivanje, refundaciju ili ' +
      'bilo koju promenu rezervacije — u tom slučaju nacrt mora eksplicitno reći da zaposleni treba da proveri ' +
      'iznos/obavezu pre slanja. Ne izmišljaj podatke (brojeve rezervacija, cene, datume) koji nisu u poruci. ' +
      'Odgovori TAČNO u formatu:\nSAŽETAK: <tekst>\nNACRT: <tekst>';

    const startedAt = Date.now();
    const response = await client.messages.create({
      model: AnthropicClientService.MODEL,
      max_tokens: 768,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Dolazna poruka:\n${inboundBody}` }],
    });
    const latencyMs = Date.now() - startedAt;
    const textBlock = response.content.find((b: any) => b.type === 'text') as { text: string } | undefined;
    const rawText = textBlock?.text?.trim() ?? '';

    const { summary, draft } = parseSummaryAndDraft(rawText);

    const agent = await this.prisma.aIAgent.findFirst({ where: { agentRole: 'EMAIL_INBOX_AGENT' } });
    if (agent) {
      await this.invocationLog.record({
        agentId: agent.id,
        actionCode: 'email.summarize-draft',
        requestedTier: agent.modelTier ?? 'LIGHT',
        securityCritical: false,
        modelIdentifier: AnthropicClientService.MODEL,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        latencyMs,
      });
    }

    return { aiSummary: summary, draftBody: draft, containsSensitiveTopic };
  }
}

function parseSummaryAndDraft(rawText: string): { summary: string | null; draft: string | null } {
  const summaryMatch = rawText.match(/SAŽETAK:\s*([\s\S]*?)(?=\nNACRT:|$)/i);
  const draftMatch = rawText.match(/NACRT:\s*([\s\S]*)$/i);
  const summary = summaryMatch ? summaryMatch[1].trim() : rawText.slice(0, 300).trim() || null;
  const draft = draftMatch ? draftMatch[1].trim() : null;
  return { summary: summary || null, draft: draft || null };
}
