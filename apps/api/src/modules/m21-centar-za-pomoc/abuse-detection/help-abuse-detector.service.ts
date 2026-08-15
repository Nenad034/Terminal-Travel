import { Injectable } from '@nestjs/common';
import { HelpQuestion } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { HealthSignalsService } from '../../m18-operativni-nadzor/health-signals/health-signals.service';

// M21 spec §5.5 — pragovi su konstante ovde, ne izmišljeni brojevi razbacani po kodu; isti
// princip kao M18 HealthDetectorsService (spec §11 kaže "podešava se empirijski kad sistem
// počne da radi u produkciji" — vrednosti ispod su svesni, konzervativni polazni pragovi).
const FREQUENCY_WINDOW_MINUTES = 10;
const FREQUENCY_WARNING_THRESHOLD = 8;
const FREQUENCY_CRITICAL_THRESHOLD = 15;

// M21 spec §5.5 — mala, eksplicitna lista fraza koje liče na pokušaj zaobilaženja ograde iz
// poglavlja 5.2 ("zanemari prethodna uputstva" i slično). Heuristika v1 (jednostavna pravila),
// ne poseban ML model — dorađuje se ako se pokaže potreba (isto ograničenje kao M18 §2.1).
const SUSPICIOUS_PHRASES = [
  'zanemari prethodna',
  'zanemari sva uputstva',
  'ignoriši uputstva',
  'ignorisi uputstva',
  'zaboravi prethodna',
  'zaboravi uputstva',
  'otkrij podatke o drugom',
  'otkrij podatke drugog',
  'pretvaraj se da',
  'ignore previous instructions',
  'ignore all previous instructions',
  'disregard previous instructions',
  'you are now',
  'reveal your system prompt',
  'otkrij svoj sistemski prompt',
];

// M21 spec §5.5 — real-time po pitanju (NE cron, za razliku od HelpSuggestionsService), jer je
// bezbednosno osetljivo. Poziva ga isključivo HelpAssistantService.ask(), posle upisa
// HelpQuestion (spec §5.5, "svako pitanje/odgovor upisuje se... i M18 HealthSignal").
@Injectable()
export class HelpAbuseDetectorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthSignals: HealthSignalsService,
  ) {}

  async checkAfterQuestion(question: HelpQuestion): Promise<void> {
    await Promise.all([this.checkFrequency(question), this.checkSuspiciousPhrase(question)]);
  }

  private async checkFrequency(question: HelpQuestion): Promise<void> {
    const since = new Date(Date.now() - FREQUENCY_WINDOW_MINUTES * 60 * 1000);
    const count = await this.prisma.helpQuestion.count({
      where: { askedBy: question.askedBy, createdAt: { gte: since } },
    });
    if (count < FREQUENCY_WARNING_THRESHOLD) return;

    await this.healthSignals.create({
      sourceModule: 'M21',
      signalType: 'HELP_AGENT_ABUSE_PATTERN',
      severity: count >= FREQUENCY_CRITICAL_THRESHOLD ? 'CRITICAL' : 'WARNING',
      securityCategory: 'API_ABUSE',
      details: {
        reason: 'unusual_question_frequency',
        askedBy: question.askedBy,
        count,
        windowMinutes: FREQUENCY_WINDOW_MINUTES,
      },
    });
  }

  private async checkSuspiciousPhrase(question: HelpQuestion): Promise<void> {
    const lower = question.questionText.toLowerCase();
    const matched = SUSPICIOUS_PHRASES.find((phrase) => lower.includes(phrase));
    if (!matched) return;

    await this.healthSignals.create({
      sourceModule: 'M21',
      signalType: 'HELP_AGENT_ABUSE_PATTERN',
      severity: 'WARNING',
      securityCategory: 'API_ABUSE',
      details: {
        reason: 'suspicious_phrase',
        askedBy: question.askedBy,
        questionId: question.id,
        matchedPhrase: matched,
      },
    });
  }
}
