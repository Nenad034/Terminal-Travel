import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

// M21 spec §5.2a / M23 spec §3.2a — vlasnikova odluka (21.8.2026): OpenAI text-embedding-3-small
// za semantičku pretragu M21/M23 članaka (pgvector, docker-compose.yml). Odvojen provajder od
// AnthropicClientService (Claude ne nudi embeddings API) — isti graceful-degradation princip:
// ako OPENAI_API_KEY nije podešen, servis NE baca grešku, pozivaoci padaju na postojeći
// heuristički (ključne reči) fallback koji je već postojao pre ove dopune.
@Injectable()
export class OpenAiEmbeddingService {
  private readonly logger = new Logger(OpenAiEmbeddingService.name);
  private readonly client: OpenAI | null;

  static readonly MODEL = 'text-embedding-3-small';
  static readonly DIMENSIONS = 1536;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  /** Vraća vektore u istom redosledu kao ulazni tekstovi. Baca grešku ako provajder nije podešen
   * ili poziv ne uspe — pozivalac (HelpAssistantService/KnowledgeAssistantService) hvata i pada
   * na heuristički fallback, isti obrazac kao AnthropicClientService pozivi. */
  async embed(texts: string[]): Promise<number[][]> {
    if (!this.client) {
      throw new Error('OPENAI_API_KEY nije podešen — proveri isConfigured() pre poziva.');
    }
    if (texts.length === 0) return [];
    const response = await this.client.embeddings.create({
      model: OpenAiEmbeddingService.MODEL,
      input: texts,
    });
    return response.data.map((d) => d.embedding);
  }
}
