import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AnthropicClientService } from '../anthropic/anthropic-client.service';
import { GeminiEmbeddingService } from '../gemini/gemini-embedding.service';

export type AssistantConfidence = 'HIGH' | 'LOW' | 'NONE';

export interface AssistantCandidate {
  articleId: string;
  /** ID reda u tabeli prevoda (embedding kolona živi tamo, ne na `articleId`). */
  translationId: string;
  title: string;
  body: string;
  /**
   * Prioritet NEZAVISNO od distance/score (M21 "kritičan primer", §4/§5.2a) — uvek uključen u
   * kandidate, ostali ulaze samo unutar praga. M23 ga nikad ne postavlja (nema taj koncept),
   * pa se za M23 ponašanje svodi tačno na "sortiraj po distanci/skoru", bez izmene.
   */
  isPriority?: boolean;
}

export interface AssistantAnswer {
  answerText: string | null;
  matchedArticleIds: string[];
  confidence: AssistantConfidence;
  usedAnthropic: boolean;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

const CANDIDATE_LIMIT = 5;
// Heuristički prag "dovoljno preklapanja da ponudimo LOW odgovor bez jezičkog modela" —
// fallback kad ANTHROPIC_API_KEY nije podešen, ne primarni put.
const MIN_HEURISTIC_OVERLAP = 2;
// pgvector kosinusna distanca (0 = identično, 2 = suprotno) — empirijski izabrana vrednost,
// doraditi ako se pokaže previše/premalo strogo.
const MAX_EMBEDDING_DISTANCE = 0.6;

const EMPTY_ANSWER: AssistantAnswer = {
  answerText: null,
  matchedArticleIds: [],
  confidence: 'NONE',
  usedAnthropic: false,
  inputTokens: 0,
  outputTokens: 0,
  latencyMs: 0,
};

/**
 * Nalaz 3.5 (dok. 39, vlasnikova odluka 7.9.2026: "jedan AI asistent") — deljena RAG logika iza
 * M21 HelpAssistantService i M23 KnowledgeAssistantService, koje su do 7.9.2026 bile dve gotovo
 * identične implementacije (825 linija ukupno) iste tehnike nad različitim sadržajem.
 *
 * SPOJENA JE SAMO TEHNIKA (embedding selekcija, keyword fallback, Anthropic poziv sa
 * prompt-injection ogradom) — ne sadržaj ni pristupna pravila. M21 (uputstvo za korišćenje
 * platforme, sa audience filterom i eskalacijom ka M14 tiketu) i M23 (znanje o destinacijama,
 * bez audience filtera, sa "zahtev za istraživanje") ostaju odvojeni sadržajni domeni sa
 * odvojenim tabelama (`HelpArticle`/`HelpQuestion` naspram `Article`/`Question`) — spajanje
 * SADRŽAJA bi zahtevalo migraciju podataka i menjanje pristupnih pravila, što nije bio zahtev.
 * Svaki pozivalac ostaje odgovoran za: učitavanje sopstvenih kandidata (uz svoj filter — audience
 * za M21, status=PUBLISHED za oba), upis u sopstvenu `*Question` tabelu, sopstven audit trag i
 * sopstvenu eskalacionu putanju.
 */
@Injectable()
export class AssistantEngineService {
  private readonly logger = new Logger(AssistantEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropic: AnthropicClientService,
    private readonly geminiEmbedding: GeminiEmbeddingService,
  ) {}

  async resolveAnswer(params: {
    question: string;
    candidates: AssistantCandidate[];
    /** Tabela sa `embedding` kolonom za ovaj sadržajni domen — `help_article_translations` (M21) ili `article_translations` (M23). */
    embeddingTable: 'help_article_translations' | 'article_translations';
    /** Persona + pravila (uklj. `noAnswerMarker` u tekstu) — člancima i pitanjem se dopunjuje u korisničkoj poruci, ne ovde. */
    systemPrompt: string;
    /** Marker kojim model MORA odgovoriti kad prosleđeni članci ne pokrivaju pitanje (§X.2 obrazac). */
    noAnswerMarker: string;
  }): Promise<AssistantAnswer> {
    const { question, candidates, embeddingTable, systemPrompt, noAnswerMarker } = params;
    if (candidates.length === 0) return EMPTY_ANSWER;

    const relevant = this.geminiEmbedding.isConfigured()
      ? await this.selectByEmbedding(question, candidates, embeddingTable, !this.anthropic.isConfigured())
      : this.selectByKeywords(question, candidates);

    if (relevant.length === 0) return EMPTY_ANSWER;

    if (!this.anthropic.isConfigured()) {
      // Heuristički fallback bez jezičkog modela — deterministički, nikad HIGH (ograda je
      // strukturna preko `relevant` skupa, ali odgovor bez stvarnog razumevanja pitanja se
      // svesno drži na LOW, ne HIGH).
      return this.heuristicAnswer(relevant);
    }

    try {
      return await this.askAnthropic(question, relevant, systemPrompt, noAnswerMarker);
    } catch (err) {
      this.logger.warn(`Anthropic poziv nije uspeo: ${(err as Error).message}`);
      return this.heuristicAnswer(relevant);
    }
  }

  private heuristicAnswer(relevant: AssistantCandidate[]): AssistantAnswer {
    const top = relevant[0];
    return {
      answerText: `${top.title}\n\n${top.body}`,
      matchedArticleIds: relevant.map((c) => c.articleId),
      confidence: 'LOW',
      usedAnthropic: false,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
    };
  }

  private selectByKeywords(question: string, candidates: AssistantCandidate[]): AssistantCandidate[] {
    return this.scoreCandidates(question, candidates)
      .filter((c) => c.score >= MIN_HEURISTIC_OVERLAP || c.isPriority)
      .slice(0, CANDIDATE_LIMIT);
  }

  private scoreCandidates(question: string, candidates: AssistantCandidate[]): (AssistantCandidate & { score: number })[] {
    const questionWords = significantWords(question);
    return candidates
      .map((c) => {
        const articleWords = new Set([...significantWords(c.title), ...significantWords(c.body)]);
        return { ...c, score: questionWords.filter((w) => articleWords.has(w)).length };
      })
      .sort((a, b) => (b.isPriority ? 1 : 0) - (a.isPriority ? 1 : 0) || b.score - a.score);
  }

  // Semantička selekcija preko pgvector kosinusne distance. Pada nazad na ključne reči ako
  // embedding poziv/upit ne uspe — semantička pretraga je poboljšanje kvaliteta, ne novi uslov
  // za rad asistenta. `applyDistanceThreshold=false` (kad je Anthropic podešen) namerno vraća
  // top-N BEZ praga — jezički model sam prepoznaje irelevantnost preko `noAnswerMarker`.
  private async selectByEmbedding(
    question: string,
    candidates: AssistantCandidate[],
    table: 'help_article_translations' | 'article_translations',
    applyDistanceThreshold: boolean,
  ): Promise<AssistantCandidate[]> {
    try {
      await this.ensureEmbeddings(candidates, table);
      const [questionVector] = await this.geminiEmbedding.embed([question]);
      const ids = candidates.map((c) => c.translationId);
      const ranked = await this.prisma.$queryRaw<{ id: string; distance: number }[]>(
        Prisma.sql`SELECT id, embedding <=> ${toVectorLiteral(questionVector)}::vector AS distance
                    FROM ${Prisma.raw(table)}
                    WHERE id IN (${Prisma.join(ids)}) AND embedding IS NOT NULL
                    ORDER BY distance ASC`,
      );
      const byId = new Map(candidates.map((c) => [c.translationId, c]));

      const priority = candidates.filter((c) => c.isPriority);
      const semantic = ranked
        .filter((r) => (!applyDistanceThreshold || r.distance <= MAX_EMBEDDING_DISTANCE) && !byId.get(r.id)?.isPriority)
        .map((r) => byId.get(r.id))
        .filter((c): c is AssistantCandidate => Boolean(c));

      return [...priority, ...semantic].slice(0, CANDIDATE_LIMIT);
    } catch (err) {
      this.logger.warn(`Embedding pretraga nije uspela, prelazim na ključne reči: ${(err as Error).message}`);
      return this.selectByKeywords(question, candidates);
    }
  }

  private async ensureEmbeddings(candidates: AssistantCandidate[], table: 'help_article_translations' | 'article_translations'): Promise<void> {
    const ids = candidates.map((c) => c.translationId);
    if (ids.length === 0) return;
    const missing = await this.prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM ${Prisma.raw(table)} WHERE id IN (${Prisma.join(ids)}) AND embedding IS NULL`,
    );
    if (missing.length === 0) return;
    const missingIds = new Set(missing.map((m) => m.id));
    const toEmbed = candidates.filter((c) => missingIds.has(c.translationId));
    const vectors = await this.geminiEmbedding.embed(toEmbed.map((c) => embedText(c)));
    await Promise.all(
      toEmbed.map((c, i) =>
        this.prisma.$executeRaw(
          Prisma.sql`UPDATE ${Prisma.raw(table)} SET embedding = ${toVectorLiteral(vectors[i])}::vector WHERE id = ${c.translationId}`,
        ),
      ),
    );
  }

  private async askAnthropic(
    question: string,
    relevant: AssistantCandidate[],
    systemPrompt: string,
    noAnswerMarker: string,
  ): Promise<AssistantAnswer> {
    const client = this.anthropic.getClient();

    const articlesBlock = relevant
      .map((c, i) => `[Članak ${i + 1}]${c.isPriority ? ' (kritičan primer)' : ''}\nNaslov: ${c.title}\nSadržaj:\n${c.body}`)
      .join('\n\n---\n\n');
    const userPrompt = `Članci na koje smeš da se osloniš:\n\n${articlesBlock}\n\nPitanje korisnika: ${question}`;

    const startedAt = Date.now();
    const response = await client.messages.create({
      model: AnthropicClientService.MODEL,
      max_tokens: 768,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const latencyMs = Date.now() - startedAt;
    const textBlock = response.content.find((b: any) => b.type === 'text') as { text: string } | undefined;
    const rawText = textBlock?.text?.trim() ?? '';

    if (!rawText || rawText.includes(noAnswerMarker)) {
      return {
        answerText: null,
        matchedArticleIds: [],
        confidence: 'NONE',
        usedAnthropic: true,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        latencyMs,
      };
    }

    return {
      answerText: rawText,
      matchedArticleIds: relevant.map((c) => c.articleId),
      confidence: 'HIGH',
      usedAnthropic: true,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
    };
  }
}

function significantWords(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter((w, i, arr) => arr.indexOf(w) === i);
}

// Ograničenje ulaza embedding modela (~8191 tokena) — konzervativno sečenje na karaktere umesto
// uvoza tokenizatora samo za ovu proveru.
function embedText(t: { title: string; body: string }): string {
  return `${t.title}\n\n${t.body}`.slice(0, 6000);
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
