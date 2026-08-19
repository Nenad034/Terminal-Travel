import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../../prisma/prisma.service';
import { estimateCostEur } from '../../m18-operativni-nadzor/agent-invocations/pricing';

const DEV_HARD_CAP_PROVIDER_NAME = 'ANTHROPIC_DEV_HARD_CAP';

// M15 spec §6.5.4.2 — provajder odluka vlasnika (avgust 2026, resolved u §11 changelog):
// Anthropic Claude, model claude-haiku-4-5-20251001 (model_tier = LIGHT, §2.1). Ako
// ANTHROPIC_API_KEY nije podešen, servis NE baca grešku — omnisearch i dalje vraća korake koji
// ne zahtevaju jezički model (§6.5.4.1 direktno poklapanje), samo bez ai_answer objašnjenja.
//
// Privremena tvrda brava za lokalno testiranje (19.8.2026, na izričit zahtev vlasnika, "dok
// testiramo") — NAMERNO odstupanje od §6.5 (koji propisuje samo prebacivanje na LIGHT tier, ne
// potpuno gašenje). Aktivna SAMO ako je ANTHROPIC_DEV_HARD_CAP_EUR podešen u .env; ne postoji u
// .env.example (ne nasleđuje se u druga okruženja). Presreće Anthropic SDK klijent na jednom
// mestu (ovde) umesto u svih 6 pozivalaca (OmnisearchService, HelpAssistantService,
// HelpSuggestionsService, SupplierDraftService, KnowledgeResearchService, KnowledgeAssistantService,
// EmailAiAssistantService) — svaki od njih već hvata grešku iz getClient()/messages.create() u
// try/catch i vraća heuristički odgovor (§6.5.2 obrazac), pa bačena greška ovde znači da AI
// asistencija privremeno "nestane" bez pada aplikacije, bez izmene ijednog pozivaoca. Ukloniti
// (ili trajno preneti u M18 §6.5 kao stvarnu politiku) kad testni period završi.
@Injectable()
export class AnthropicClientService {
  private readonly logger = new Logger(AnthropicClientService.name);
  private readonly client: Anthropic | null;
  private readonly hardCapEur: number | null;

  static readonly MODEL = 'claude-haiku-4-5-20251001';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.client = apiKey ? new Anthropic({ apiKey }) : null;

    const capRaw = this.config.get<string>('ANTHROPIC_DEV_HARD_CAP_EUR');
    this.hardCapEur = capRaw ? Number(capRaw) : null;

    if (this.client && this.hardCapEur !== null) {
      const original = this.client.messages.create.bind(this.client.messages);
      (this.client.messages.create as unknown) = async (...args: Parameters<typeof original>) => {
        await this.assertUnderDevHardCap();
        const response = await original(...args);
        const usage = (response as { usage?: { input_tokens: number; output_tokens: number } }).usage;
        if (usage) await this.recordDevSpend(usage.input_tokens, usage.output_tokens);
        return response;
      };
      this.logger.warn(`Anthropic tvrda brava za testiranje aktivna: ${this.hardCapEur}€ (privremeno, na zahtev vlasnika).`);
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  /** Naredbeni pristup — pozivalac (OmnisearchService) je jedini koji sme da poziva ovo. */
  getClient(): Anthropic {
    if (!this.client) {
      throw new Error('ANTHROPIC_API_KEY nije podešen — proveri isConfigured() pre poziva.');
    }
    return this.client;
  }

  private async getOrCreateDevQuotaRow() {
    const existing = await this.prisma.aIProviderQuota.findFirst({
      where: { providerName: DEV_HARD_CAP_PROVIDER_NAME },
    });
    if (existing) return existing;
    return this.prisma.aIProviderQuota.create({
      data: {
        providerName: DEV_HARD_CAP_PROVIDER_NAME,
        period: 'MONTHLY',
        budgetLimitEur: this.hardCapEur,
        consumedEur: 0,
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2030-01-01'),
      },
    });
  }

  private async assertUnderDevHardCap(): Promise<void> {
    const row = await this.getOrCreateDevQuotaRow();
    if (Number(row.consumedEur) >= Number(row.budgetLimitEur ?? this.hardCapEur)) {
      throw new Error(
        `Testni budžet za Anthropic (${this.hardCapEur}€) je dostignut — poziv blokiran (privremena dev brava).`,
      );
    }
  }

  private async recordDevSpend(inputTokens: number, outputTokens: number): Promise<void> {
    const cost = estimateCostEur(AnthropicClientService.MODEL, inputTokens, outputTokens);
    const row = await this.getOrCreateDevQuotaRow();
    await this.prisma.aIProviderQuota.update({
      where: { id: row.id },
      data: { consumedEur: { increment: cost } },
    });
  }
}
