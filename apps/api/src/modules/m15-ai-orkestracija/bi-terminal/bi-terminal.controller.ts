import { Body, Controller, Get, NotFoundException, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { BiTerminalService } from './bi-terminal.service';
import { BiTerminalQueryDto } from './dto/bi-terminal-query.dto';
import { SendReportChatDto } from './dto/send-report-chat.dto';
import { WebFetchDecisionDto } from './dto/web-fetch-decision.dto';
import { getReport } from './report-store';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M15 spec §6.9/§9, prefiks /api/v1/ai-orchestration. `M15/bi-terminal/VIEW` je dodeljen
// isključivo VLASNIK ulozi u seed-u (§6.9.2) — PermissionsGuard sam sprovodi to ograničenje,
// nema dodatne provere ovde (isti obrazac kao svaki drugi @RequirePermission kontroler).
@ApiTags('ai-orchestration-bi-terminal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ai-orchestration/bi-terminal')
export class BiTerminalController {
  constructor(private readonly biTerminal: BiTerminalService) {}

  @Post('query')
  @RequirePermission('M15', 'bi-terminal', 'VIEW')
  query(@Body() dto: BiTerminalQueryDto, @CurrentUser() actor: { userId: string }) {
    return this.biTerminal.query(actor.userId, dto.query);
  }

  // §6.9.3 dopuna — preuzimanje generisanog izveštaja (Excel/PDF/HTML). 30-minutni prolazan
  // zapis (report-store.ts) — ističe pre nego što VLASNIK stigne da klikne = pošteno "nije više
  // dostupno", ne tiha greška.
  @Get('reports/:id/download')
  @RequirePermission('M15', 'bi-terminal', 'VIEW')
  download(@Param('id') id: string, @Res() res: Response) {
    const report = getReport(id);
    if (!report) throw new NotFoundException('Izveštaj je istekao ili ne postoji — ponovo zatraži u terminalu.');
    res.set({ 'Content-Type': report.mimeType, 'Content-Disposition': `attachment; filename="${report.fileName}"` });
    res.send(report.buffer);
  }

  // §6.9.3 dopuna — "predloži pa čovek odobri": ovaj poziv je LJUDSKI pokrenut klik (dugme u
  // TerminalPanel.tsx), nikad nešto što BiTerminalAgent sam pozove iz tool-use petlje (agent
  // samo priprema fajl preko `generate_report`, poslati ga sme jedino stvaran klik ovde).
  @Post('reports/:id/send-chat')
  @RequirePermission('M15', 'bi-terminal', 'VIEW')
  sendChat(@Param('id') id: string, @Body() dto: SendReportChatDto, @CurrentUser() actor: { userId: string }) {
    return this.biTerminal.sendReportToChat(id, dto.conversationId, actor.userId);
  }

  // §6.9.7 — LJUDSKI pokrenut klik na "Odobri" u TerminalPanel.tsx. Tek OVDE se stvarno šalje
  // zahtev ka spoljnom serveru (safe-web-fetch.ts), nikad iz tool-use petlje u query().
  @Post('web-fetch/approve')
  @RequirePermission('M15', 'bi-terminal', 'VIEW')
  approveWebFetch(@Body() dto: WebFetchDecisionDto, @CurrentUser() actor: { userId: string }) {
    return this.biTerminal.approveWebFetch(dto.url, dto.reason, dto.originalQuestion, actor.userId);
  }

  @Post('web-fetch/deny')
  @RequirePermission('M15', 'bi-terminal', 'VIEW')
  async denyWebFetch(@Body() dto: WebFetchDecisionDto, @CurrentUser() actor: { userId: string }) {
    await this.biTerminal.denyWebFetch(dto.url, dto.reason, dto.originalQuestion, actor.userId);
    return { ok: true };
  }
}
