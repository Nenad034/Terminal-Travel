import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../m1-core-identitet/audit-log/audit-log.service';

export interface UpsertEmployeeRecordDto {
  employmentType: 'PUNO_RADNO_VREME' | 'NEPUNO_RADNO_VREME' | 'UGOVOR_O_DELU';
  contractBasis: 'NEODREDJENO' | 'ODREDJENO';
  hireDate: string;
  probationEndDate?: string | null;
  contractEndDate?: string | null;
  terminationDate?: string | null;
  reportsToUserId?: string | null;
  annualLeaveDaysEntitled?: number | null;
}

export interface CreateLeaveRecordDto {
  type: 'GODISNJI_ODMOR' | 'BOLOVANJE' | 'NEPLACENO_ODSUSTVO' | 'OSTALO';
  startDate: string;
  endDate: string;
  daysCount: number;
  note?: string | null;
}

// M24 spec — HR dosije zaposlenog (§2.2), odsustva (§2.3). `EmployeeRecord` NE postoji za
// svakog korisnika (samo popunjen kad HR/Vlasnik/Direktor unese podatke) — `getEmployeeRecord`
// vraća `null` umesto 404, isti princip kao "prazan ekran je prazna baza, ne pokvaren kod"
// (`33-ZAMKE-I-OBAVEZNE-PROVERE.md` 7.2) primenjen na API nivou.
@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  getEmployeeRecord(userId: string) {
    return this.prisma.employeeRecord.findUnique({
      where: { userId },
      include: { trainingCertifications: true },
    });
  }

  // PATCH radi upsert (isti obrazac kao AgencySettings — nema posebnog "kreiraj" koraka za
  // korisnika koji dosad nije imao HR dosije, formular se prosto prvi put čuva).
  async upsertEmployeeRecord(
    userId: string,
    dto: UpsertEmployeeRecordDto,
    actorId: string,
  ) {
    const data = {
      employmentType: dto.employmentType,
      contractBasis: dto.contractBasis,
      hireDate: new Date(dto.hireDate),
      probationEndDate: dto.probationEndDate ? new Date(dto.probationEndDate) : null,
      contractEndDate: dto.contractEndDate ? new Date(dto.contractEndDate) : null,
      terminationDate: dto.terminationDate ? new Date(dto.terminationDate) : null,
      reportsToUserId: dto.reportsToUserId ?? null,
      annualLeaveDaysEntitled: dto.annualLeaveDaysEntitled ?? null,
      updatedByUserId: actorId,
    };

    const before = await this.prisma.employeeRecord.findUnique({ where: { userId } });
    const after = await this.prisma.employeeRecord.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M24',
      action: before ? 'employee-record.updated' : 'employee-record.created',
      resourceType: 'EmployeeRecord',
      resourceId: after.id,
      beforeState: before ?? undefined,
      afterState: after,
      context: { userId },
    });
    return after;
  }

  async listLeaveRecords(userId: string) {
    const record = await this.prisma.employeeRecord.findUnique({ where: { userId } });
    if (!record) return [];
    return this.prisma.leaveRecord.findMany({
      where: { employeeRecordId: record.id },
      orderBy: { startDate: 'desc' },
    });
  }

  async createLeaveRecord(userId: string, dto: CreateLeaveRecordDto, actorId: string) {
    const record = await this.prisma.employeeRecord.findUnique({ where: { userId } });
    if (!record) {
      throw new BadRequestException(
        'HR dosije za ovog zaposlenog još nije popunjen — popunite osnovne podatke pre evidentiranja odsustva.',
      );
    }
    const leave = await this.prisma.leaveRecord.create({
      data: {
        employeeRecordId: record.id,
        type: dto.type,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        daysCount: dto.daysCount,
        note: dto.note ?? null,
        recordedByUserId: actorId,
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M24',
      action: 'leave-record.created',
      resourceType: 'LeaveRecord',
      resourceId: leave.id,
      afterState: leave,
      context: { userId },
    });
    return leave;
  }

  // M24 spec §2.3 — preostali dani = dodeljeno − suma GODISNJI_ODMOR tekuće godine, izračunato,
  // ne čuvano polje (princip #1, jedan izvor istine).
  async getLeaveBalance(userId: string) {
    const record = await this.prisma.employeeRecord.findUnique({ where: { userId } });
    if (!record || record.annualLeaveDaysEntitled == null) {
      return { entitled: null, used: 0, remaining: null };
    }
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const yearEnd = new Date(new Date().getFullYear() + 1, 0, 1);
    const usedRows = await this.prisma.leaveRecord.findMany({
      where: {
        employeeRecordId: record.id,
        type: 'GODISNJI_ODMOR',
        startDate: { gte: yearStart, lt: yearEnd },
      },
      select: { daysCount: true },
    });
    const used = usedRows.reduce((sum, r) => sum + r.daysCount, 0);
    return {
      entitled: record.annualLeaveDaysEntitled,
      used,
      remaining: record.annualLeaveDaysEntitled - used,
    };
  }
}
