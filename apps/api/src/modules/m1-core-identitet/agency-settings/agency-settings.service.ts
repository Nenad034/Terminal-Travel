import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UpdateAgencySettingsDto } from './dto/update-agency-settings.dto';

// M1 spec §3.9c (7.9.2026) — identitet same agencije. Isti obrazac kao `BranchesService`
// (jednostavan entitet + audit log), sa jednom razlikom: ovo je SINGLETON — jedan red za celu
// instalaciju, `id = 'singleton'`. Više redova bi značilo "više agencija u istoj bazi", a prava
// multi-tenant izolacija je svesno odložena (docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md).
@Injectable()
export class AgencySettingsService {
  static readonly ID = 'singleton';

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // Red uvek postoji (seed ga pravi). `upsert` je ipak ovde, ne `findUniqueOrThrow`: baza koja
  // nikad nije seed-ovana (svež klon, testno okruženje) inače bi rušila SVAKI ekran koji traži
  // naziv agencije — a to je podnožje sajta i naslov svake stranice. Prazan naziv je manji kvar
  // od pada; zamka 5.x („prazan ekran je prazna baza, ne pokvaren kod").
  async get() {
    return this.prisma.agencySettings.upsert({
      where: { id: AgencySettingsService.ID },
      update: {},
      create: { id: AgencySettingsService.ID, brandName: 'Terminal Travel' },
    });
  }

  // Samo prikazna polja — ovo ide na JAVAN endpoint (§6), bez tokena. `taxId` i `licenseNumber`
  // se NIKAD ne vraćaju odavde: pojavljuju se isključivo na ugovoru sa gostom (M20 §2.3), gde su
  // zakonski obavezni i gde ih vidi samo strana u tom ugovoru.
  async getPublic() {
    const s = await this.get();
    return {
      brandName: s.brandName,
      email: s.email,
      phone: s.phone,
      website: s.website,
      address: s.address,
    };
  }

  async update(dto: UpdateAgencySettingsDto, actorId: string) {
    const before = await this.get();
    const after = await this.prisma.agencySettings.update({
      where: { id: AgencySettingsService.ID },
      data: { ...dto, updatedByUserId: actorId },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M1',
      action: 'agency_settings.updated',
      resourceType: 'AgencySettings',
      resourceId: AgencySettingsService.ID,
      beforeState: before,
      afterState: after,
      context: {},
    });
    return after;
  }
}
