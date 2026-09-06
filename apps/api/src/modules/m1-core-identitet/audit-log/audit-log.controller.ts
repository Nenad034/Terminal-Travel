import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditLogService } from './audit-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { parsePagination } from '../../../common/pagination/pagination';

// Nalaz (29.8.2026, pri dodavanju pretrage po datumu) — `to` iz `<input type="date">` stiže
// kao "YYYY-MM-DD" bez vremena; `new Date("2026-08-29")` je ponoć TOG dana (00:00:00.000Z), pa bi
// `timestamp <= to` isključio SVE zapise tog dana napravljene posle ponoći — u praksi skoro sve.
// Za datum-bez-vremena, "do datuma" znači "zaključno sa krajem tog dana", ne "do njegove ponoći".
export function endOfDayIfDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value);
  // `new Date("YYYY-MM-DD")` je UTC ponoć (ECMA-262) — dodavanje skoro punog dana u ms
  // izbegava dvosmislenost lokalne vs. UTC vremenske zone koju bi nosio string sa vremenom
  // bez eksplicitnog "Z" ofseta.
  const utcMidnight = new Date(value);
  return new Date(utcMidnight.getTime() + 24 * 60 * 60 * 1000 - 1);
}

// M1 spec §6 — GET /audit-log, samo za M1/audit-log/VIEW (podrazumevano Vlasnik, Direktor)
@ApiTags('audit-log')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('iam/audit-log')
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  // Straničenje (6.9.2026, dok. 39 nalaz 2.2) — odgovor je od sada `{ data, total, page,
  // limit, pageCount, hasMore }`, ne go niz. `page`/`limit` se čitaju kao POJEDINAČNI
  // parametri, ne kao DTO: globalni `ValidationPipe` radi sa `forbidNonWhitelisted`, pa bi
  // `@Query() dto` oborio sve ostale filtere ovog endpointa na `400` (v. komentar u
  // common/pagination/pagination.ts — greška već jednom napravljena na listi rezervacija).
  @Get()
  @RequirePermission('M1', 'audit-log', 'VIEW')
  find(
    @Query('module') module?: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditLog.find(
      {
        module,
        actorId,
        actions: action ? action.split(',').map((a) => a.trim()).filter(Boolean) : undefined,
        q,
        from: from ? new Date(from) : undefined,
        to: to ? endOfDayIfDateOnly(to) : undefined,
      },
      parsePagination(page, limit),
    );
  }
}
