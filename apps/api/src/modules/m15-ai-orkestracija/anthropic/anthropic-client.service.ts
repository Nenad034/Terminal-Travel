import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

// M15 spec §6.5.4.2 — provajder odluka vlasnika (avgust 2026, resolved u §11 changelog):
// Anthropic Claude, model claude-haiku-4-5-20251001 (model_tier = LIGHT, §2.1). Ako
// ANTHROPIC_API_KEY nije podešen, servis NE baca grešku — omnisearch i dalje vraća korake koji
// ne zahtevaju jezički model (§6.5.4.1 direktno poklapanje), samo bez ai_answer objašnjenja.
@Injectable()
export class AnthropicClientService {
  private readonly logger = new Logger(AnthropicClientService.name);
  private readonly client: Anthropic | null;

  static readonly MODEL = 'claude-haiku-4-5-20251001';

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
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
}
