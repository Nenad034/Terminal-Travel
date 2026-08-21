import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

// M21 spec §5.2a / M23 spec §3.2a — vlasnikova odluka (21.8.2026, promenjeno istog dana sa
// prvobitno biranog OpenAI-a na Google Gemini): `gemini-embedding-2` za semantičku pretragu
// M21/M23 članaka (pgvector, docker-compose.yml). `outputDimensionality: 1536` bira se
// eksplicitno da odgovara već napravljenoj `vector(1536)` koloni (šema nije menjana pri
// promeni provajdera). Isti graceful-degradation princip kao AnthropicClientService: ako
// GEMINI_API_KEY nije podešen, servis NE baca grešku, pozivaoci padaju na postojeći
// heuristički (ključne reči) fallback.
@Injectable()
export class GeminiEmbeddingService {
  private readonly logger = new Logger(GeminiEmbeddingService.name);
  private readonly client: GoogleGenAI | null;

  static readonly MODEL = 'gemini-embedding-2';
  static readonly DIMENSIONS = 1536;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  /** Vraća vektore u istom redosledu kao ulazni tekstovi. Baca grešku ako provajder nije podešen
   * ili poziv ne uspe — pozivalac (HelpAssistantService/KnowledgeAssistantService) hvata i pada
   * na heuristički fallback, isti obrazac kao AnthropicClientService pozivi.
   *
   * Svaki tekst se šalje kao poseban `Content` objekat (`{ parts: [{ text }] }`) — Gemini
   * agregira u JEDAN embedding ako se ceo niz stringova prosledi direktno kao `contents`
   * (dokumentovano ponašanje), što bi pomešalo embedding-e više različitih članaka u jedan. */
  async embed(texts: string[]): Promise<number[][]> {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY nije podešen — proveri isConfigured() pre poziva.');
    }
    if (texts.length === 0) return [];
    const response = await this.client.models.embedContent({
      model: GeminiEmbeddingService.MODEL,
      contents: texts.map((text) => ({ parts: [{ text }] })),
      config: { outputDimensionality: GeminiEmbeddingService.DIMENSIONS },
    });
    if (!response.embeddings || response.embeddings.length !== texts.length) {
      throw new Error(`Gemini embed poziv vratio neočekivan broj vektora (${response.embeddings?.length ?? 0} za ${texts.length} teksta).`);
    }
    return response.embeddings.map((e) => {
      if (!e.values) throw new Error('Gemini embed poziv vratio prazan vektor.');
      return e.values;
    });
  }
}
