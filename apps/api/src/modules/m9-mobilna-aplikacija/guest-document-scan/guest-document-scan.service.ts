import { Injectable, Logger } from '@nestjs/common';
import { AnthropicClientService } from '../../m15-ai-orkestracija/anthropic/anthropic-client.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';

export const ALLOWED_DOCUMENT_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface ScannedDocumentFields {
  documentDetected: boolean;
  fullName: string | null;
  documentType: 'PASSPORT' | 'LICNA_KARTA' | null;
  documentNumber: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  /** Objašnjenje kad nešto nije pouzdano pročitano — gost i dalje mora ručno da dopuni/potvrdi. */
  warning?: string;
}

const UNREADABLE_RESULT: ScannedDocumentFields = {
  documentDetected: false,
  fullName: null,
  documentType: null,
  documentNumber: null,
  nationality: null,
  dateOfBirth: null,
  warning: 'Nismo uspeli da pročitamo dokument sa fotografije — unesite podatke ručno.',
};

// M15 spec §6.5.6e — strogo strukturisan izlaz (ne slobodan razgovor), model MORA da vrati
// isključivo JSON po ovoj šemi; nikad izmišljena vrednost za polje koje ne može pouzdano da
// pročita (null umesto pogađanja).
const SYSTEM_PROMPT =
  'Iz priložene fotografije putnog dokumenta (pasoš ili lična karta) izvuci podatke i vrati ISKLJUČIVO ' +
  'validan JSON, bez ijedne reči teksta pre ili posle, tačno ovog oblika: ' +
  '{"documentDetected": boolean, "fullName": string|null, "documentType": "PASSPORT"|"LICNA_KARTA"|null, ' +
  '"documentNumber": string|null, "nationality": string|null, "dateOfBirth": string|null}. ' +
  'dateOfBirth mora biti u formatu GGGG-MM-DD ili null. Ako slika nije čitljiv putni dokument, postavi ' +
  'documentDetected na false i sva ostala polja na null. Za svako polje koje ne možeš pouzdano da pročitaš ' +
  '(nejasno, zamućeno, delimično van kadra) vrati null za TO polje — nikad ne pogađaj niti izmišljaj vrednost.';

// M15 spec §6.5.6e / M9 spec §2a — gost fotografiše sopstveni pasoš, slika se obrađuje
// tranzientno (nikad ne dodiruje disk, buffer se odbacuje čim poziv završi) i NIKAD se ne
// čuva — ni sama slika ni referenca na nju ne postoje nigde u modelu posle ovog poziva.
@Injectable()
export class GuestDocumentScanService {
  private readonly logger = new Logger(GuestDocumentScanService.name);

  constructor(
    private readonly anthropic: AnthropicClientService,
    private readonly auditLog: AuditLogService,
  ) {}

  async scan(file: Express.Multer.File, actorUserId: string): Promise<ScannedDocumentFields> {
    const result = await this.extract(file);

    // Log RADNJU (pokušaj + uspeh/neuspeh), nikad sadržaj slike ili izvučene lične podatke —
    // isti princip kao svaka druga privatnošću osetljiva radnja (M15 §6.5.6e).
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actorUserId,
      module: 'M9',
      action: 'guest_document_scan.attempted',
      resourceType: 'GuestProfile',
      resourceId: actorUserId,
      context: { documentDetected: result.documentDetected, hadWarning: Boolean(result.warning) },
    });

    return result;
  }

  private async extract(file: Express.Multer.File): Promise<ScannedDocumentFields> {
    if (!ALLOWED_DOCUMENT_IMAGE_MIME_TYPES.has(file.mimetype)) {
      return { ...UNREADABLE_RESULT, warning: 'Nepodržan format slike — koristite JPEG, PNG ili WEBP.' };
    }
    if (!this.anthropic.isConfigured()) {
      return { ...UNREADABLE_RESULT, warning: 'Skeniranje trenutno nije dostupno — unesite podatke ručno.' };
    }

    try {
      const client = this.anthropic.getClient();
      const response = await client.messages.create({
        model: AnthropicClientService.MODEL,
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: file.mimetype as 'image/jpeg' | 'image/png' | 'image/webp',
                  data: file.buffer.toString('base64'),
                },
              },
              { type: 'text', text: 'Izvuci podatke iz ovog putnog dokumenta i vrati isključivo JSON po zadatoj šemi.' },
            ],
          },
        ],
      });
      const textBlock = response.content.find((b: any) => b.type === 'text') as { text: string } | undefined;
      return this.parseAndValidate(textBlock?.text);
    } catch (err) {
      this.logger.warn(`Skeniranje putnog dokumenta nije uspelo: ${err instanceof Error ? err.message : String(err)}`);
      return UNREADABLE_RESULT;
    }
  }

  private parseAndValidate(rawText: string | undefined): ScannedDocumentFields {
    if (!rawText) return UNREADABLE_RESULT;

    let parsed: Record<string, unknown>;
    try {
      // Model ponekad omota JSON u ```json blok i pored eksplicitnog uputstva da ne sme.
      const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
      parsed = JSON.parse(cleaned);
    } catch {
      return UNREADABLE_RESULT;
    }

    if (parsed.documentDetected !== true) {
      return { ...UNREADABLE_RESULT, warning: 'Fotografija ne izgleda kao čitljiv putni dokument — unesite podatke ručno.' };
    }

    const fullName = this.cleanString(parsed.fullName);
    const documentType = parsed.documentType === 'PASSPORT' || parsed.documentType === 'LICNA_KARTA' ? parsed.documentType : null;
    const documentNumber = this.cleanString(parsed.documentNumber);
    const nationality = this.cleanString(parsed.nationality);
    const dateOfBirth = this.cleanDate(parsed.dateOfBirth);

    const missingSomething = !fullName || !documentType || !documentNumber || !nationality || !dateOfBirth;

    return {
      documentDetected: true,
      fullName,
      documentType,
      documentNumber,
      nationality,
      dateOfBirth,
      warning: missingSomething ? 'Neka polja nisu pouzdano pročitana — proverite i dopunite pre čuvanja.' : undefined,
    };
  }

  private cleanString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private cleanDate(value: unknown): string | null {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsedDate = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() >= Date.now()) return null;
    return value;
  }
}
