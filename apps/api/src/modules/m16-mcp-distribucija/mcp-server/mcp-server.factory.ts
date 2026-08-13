import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/server';
import type { McpServerFactory } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { McpToolsService } from './mcp-tools.service';
import { PrismaService } from '../../../prisma/prisma.service';

const productTypeEnum = z.enum([
  'ACCOMMODATION',
  'PACKAGE',
  'TRANSFER',
  'EXCURSION',
  'FLIGHT',
  'INSURANCE',
  'TRANSPORT',
  'TICKET',
  'EVENT',
]);

const occupancySchema = z.object({ adults: z.number().int().min(0), children: z.number().int().min(0) });

const quoteItemSchema = z.object({
  productId: z.string(),
  stayFrom: z.string(),
  stayTo: z.string(),
  occupancy: occupancySchema,
});

const guestSchema = z.object({ itemIndex: z.number().int(), firstName: z.string(), lastName: z.string() });

/**
 * Gradi jedan `McpServer` po zahtevu (MCP 2026-07-28 je stateless, §1.1 M16 spec) — tool
 * handleri zatvaraju nad `ctx.authInfo` (postavljen u McpController pre `handler.fetch`)
 * da znaju koji MCPClientRegistration poziva, bez čuvanja stanja između poziva.
 */
@Injectable()
export class McpServerFactoryService {
  constructor(
    private readonly tools: McpToolsService,
    private readonly prisma: PrismaService,
  ) {}

  build(): McpServerFactory {
    return async (ctx) => {
      const server = new McpServer({ name: 'terminal-travel', version: '1.0.0' });
      const clientId = ctx.authInfo?.clientId;
      const accessLevel = ctx.authInfo?.scopes[0] ?? 'READ_ONLY';

      // clientId je MCPClientRegistration.id (M16 spec §3.1) — razrešava se na linked_user_id
      // tek ovde (ne u McpController) da factory ostane jedino mesto koje zna DTO oblik alata.
      const registration = clientId
        ? await this.prisma.mCPClientRegistration.findUnique({ where: { id: clientId } })
        : null;
      const actorUserId = registration?.linkedUserId ?? null;

      server.registerTool(
        'search_products',
        {
          title: 'Pretraga ponude',
          description: 'M5 /search — isti rezultati i marža kao na B2C sajtu (M8).',
          inputSchema: z.object({
            type: z.array(productTypeEnum).optional(),
            destinationCountry: z.string().optional(),
            destinationCity: z.string().optional(),
            stayFrom: z.string().optional(),
            stayTo: z.string().optional(),
            adults: z.number().int().optional(),
            children: z.number().int().optional(),
            lang: z.string().optional(),
          }),
        },
        async (args) => {
          const results = await this.tools.searchProducts(args as any);
          return { content: [{ type: 'text', text: JSON.stringify(results) }], structuredContent: { results } };
        },
      );

      server.registerTool(
        'create_quote',
        {
          title: 'Kreiranje ponude',
          description:
            'M5 /quotes — priprema ponudu pre potvrde rezervacije. contract_terms_accepted mora biti true (agent je prethodno pokazao uslove ugovora korisniku i dobio potvrdu) — isti zahtev kao B2C sajt, M16 spec §4.',
          inputSchema: z.object({
            items: z.array(quoteItemSchema).min(1),
            contractTermsAccepted: z.boolean(),
          }),
        },
        async (args) => {
          this.tools.assertWriteAllowed(accessLevel, 'create_quote');
          if (!actorUserId) throw new Error('MCP klijent nema aktivan servisni nalog (nije ACTIVE).');
          const quote = await this.tools.createQuote(actorUserId, args as any);
          return { content: [{ type: 'text', text: JSON.stringify(quote) }], structuredContent: quote };
        },
      );

      server.registerTool(
        'confirm_booking',
        {
          title: 'Potvrda rezervacije',
          description:
            'M5 /quotes/:id/confirm — zahteva potpune podatke gosta (buyer_name/buyer_type), isto kao svaki drugi kanal (M16 spec §4).',
          inputSchema: z.object({
            quoteId: z.string(),
            buyerName: z.string(),
            buyerType: z.enum(['FIZICKO_LICE', 'PRAVNO_LICE']),
            buyerTaxId: z.string().optional(),
            guests: z.array(guestSchema).optional(),
          }),
        },
        async (args) => {
          this.tools.assertWriteAllowed(accessLevel, 'confirm_booking');
          if (!actorUserId) throw new Error('MCP klijent nema aktivan servisni nalog (nije ACTIVE).');
          const { quoteId, ...dto } = args as any;
          const booking = await this.tools.confirmBooking(actorUserId, quoteId, dto);
          return { content: [{ type: 'text', text: JSON.stringify(booking) }], structuredContent: booking };
        },
      );

      server.registerTool(
        'get_booking_status',
        {
          title: 'Status rezervacije',
          description: 'M5 /bookings/:id — maskiran prikaz (bez supplier polja), isto kao B2C.',
          inputSchema: z.object({ bookingId: z.string() }),
        },
        async (args) => {
          if (!actorUserId) throw new Error('MCP klijent nema aktivan servisni nalog (nije ACTIVE).');
          const booking = await this.tools.getBookingStatus(actorUserId, (args as any).bookingId);
          return { content: [{ type: 'text', text: JSON.stringify(booking) }], structuredContent: booking };
        },
      );

      server.registerTool(
        'cancel_booking',
        {
          title: 'Otkazivanje rezervacije',
          description: 'M5 /bookings/:id/cancel.',
          inputSchema: z.object({ bookingId: z.string(), reason: z.string().optional() }),
        },
        async (args) => {
          this.tools.assertWriteAllowed(accessLevel, 'cancel_booking');
          if (!actorUserId) throw new Error('MCP klijent nema aktivan servisni nalog (nije ACTIVE).');
          const { bookingId, ...dto } = args as any;
          const result = await this.tools.cancelBooking(actorUserId, bookingId, dto);
          return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
        },
      );

      return server;
    };
  }
}
