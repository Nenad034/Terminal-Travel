import { ForbiddenException, Injectable } from '@nestjs/common';
import { LanguageCode, ProductType } from '@prisma/client';
import { SearchService } from '../../m5-rezervacije/search/search.service';
import { QuotesService } from '../../m5-rezervacije/quotes/quotes.service';
import { BookingsService } from '../../m5-rezervacije/bookings/bookings.service';
import { CreateQuoteDto } from '../../m5-rezervacije/quotes/dto/create-quote.dto';
import { ConfirmQuoteDto } from '../../m5-rezervacije/bookings/dto/confirm-quote.dto';
import { CancelBookingDto } from '../../m5-rezervacije/bookings/dto/cancel-booking.dto';

/**
 * M16 spec §2/§4 — pet MCP alata, svaki poziva postojeći M5 servis IN-PROCESS (DI), isti
 * presedan kao M13 → M12 (ContentService.findByTrackingCode, M12 spec v1.3). `actorUserId`
 * je uvek User.id povezanog AI_AGENT servisnog naloga (McpAdminService.activate) — M5 servisi
 * sami razrešavaju ownership/maskiranje preko resolveApiContext (bookings.service.ts), M16
 * ne duplira tu logiku.
 */
@Injectable()
export class McpToolsService {
  constructor(
    private readonly search: SearchService,
    private readonly quotes: QuotesService,
    private readonly bookings: BookingsService,
  ) {}

  // M16 spec §2 — "isti rezultati, ista već primenjena marža, kao i na M8" → ista
  // VisibleChannel.B2C_SITE vidljivost, ne nova (proizvod se ne mora posebno "objaviti za MCP").
  async searchProducts(params: {
    type?: ProductType[];
    destinationCountry?: string;
    destinationCity?: string;
    stayFrom?: string;
    stayTo?: string;
    adults?: number;
    children?: number;
    lang?: LanguageCode;
  }) {
    return this.search.search({
      type: params.type,
      destinationCountry: params.destinationCountry,
      destinationCity: params.destinationCity,
      stayFrom: params.stayFrom,
      stayTo: params.stayTo,
      occupancy:
        params.adults !== undefined ? { adults: params.adults, children: params.children ?? 0 } : undefined,
      channel: 'B2C_SITE',
      lang: params.lang,
    });
  }

  // channel/clientAccountId se namerno NE primaju od MCP klijenta — QuotesService.create
  // sam prisiljava clientAccountId na pozivaočev ClientAccount za AI_AGENT (quotes.service.ts).
  async createQuote(actorUserId: string, dto: Omit<CreateQuoteDto, 'channel' | 'clientAccountId'>) {
    return this.quotes.create({ ...dto, channel: 'MCP_AGENT' } as CreateQuoteDto, { userId: actorUserId });
  }

  // M16 spec §4 — nepotpuni podaci gosta (buyerName/buyerType) se odbijaju na nivou
  // ConfirmQuoteDto/BookingsService, isti zahtev kao bilo koji drugi kanal, bez olakšica.
  // §5 — plaćanje ostaje otvoreno pitanje; ova metoda potvrđuje rezervaciju bez naplate
  // (payment_status=UNPAID), isti obrazac kao M8 bankovni prenos.
  async confirmBooking(actorUserId: string, quoteId: string, dto: ConfirmQuoteDto) {
    return this.bookings.confirmQuote(quoteId, dto, { userId: actorUserId });
  }

  async getBookingStatus(actorUserId: string, bookingId: string) {
    return this.bookings.findOne(bookingId, actorUserId);
  }

  async cancelBooking(actorUserId: string, bookingId: string, dto: CancelBookingDto) {
    return this.bookings.cancel(bookingId, dto, { userId: actorUserId });
  }

  /** M16 spec §3.1 — READ_ONLY blokira sve osim search_products/get_booking_status. */
  assertWriteAllowed(accessLevel: string, toolName: string): void {
    if (accessLevel !== 'READ_WRITE') {
      throw new ForbiddenException(
        `Alat "${toolName}" zahteva READ_WRITE pristup (trenutno: ${accessLevel}) — kontaktirajte Terminal Travel radi odobrenja (M16 spec §3.1).`,
      );
    }
  }
}
