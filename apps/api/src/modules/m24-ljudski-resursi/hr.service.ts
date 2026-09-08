import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../m1-core-identitet/audit-log/audit-log.service';
import { PermissionsService } from '../m1-core-identitet/permissions/permissions.service';

export interface UpsertEmployeeRecordDto {
  employmentType: 'PUNO_RADNO_VREME' | 'NEPUNO_RADNO_VREME' | 'UGOVOR_O_DELU';
  contractBasis: 'NEODREDJENO' | 'ODREDJENO';
  hireDate: string;
  probationEndDate?: string | null;
  contractEndDate?: string | null;
  terminationDate?: string | null;
  reportsToUserId?: string | null;
}

// M24 spec §2.2a (predlog v1.5) — dodeljeni dani godišnjeg odmora PO GODINI, zamenjuje raniji
// flat EmployeeRecord.annualLeaveDaysEntitled. carriedOverDays je predložena/ručno potvrđena
// vrednost (Zakon o radu RS: rok 30.6. naredne godine) — sistem je NE obračunava sam.
export interface UpsertLeaveEntitlementDto {
  daysEntitled: number;
  carriedOverDays?: number | null;
  carriedOverExpiresAt?: string | null;
}

export interface CreateLeaveRecordDto {
  type: 'GODISNJI_ODMOR' | 'BOLOVANJE' | 'NEPLACENO_ODSUSTVO' | 'OSTALO';
  startDate: string;
  endDate: string;
  daysCount: number;
  note?: string | null;
}

const BLANKET_LEAVE_PERMISSION = ['M24', 'leave-record', 'CREATE'] as const;

// M24 spec — HR dosije zaposlenog (§2.2), odsustva (§2.3), zahtev/odobrenje (§3a), timski
// kalendar (§3b). `EmployeeRecord` NE postoji za svakog korisnika (samo popunjen kad HR/
// Vlasnik/Direktor ili sâm zaposleni unese podatke) — `getEmployeeRecord` vraća `null` umesto
// 404, isti princip kao "prazan ekran je prazna baza, ne pokvaren kod"
// (`33-ZAMKE-I-OBAVEZNE-PROVERE.md` 7.2) primenjen na API nivou.
@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly permissions: PermissionsService,
  ) {}

  private hasBlanketLeaveAuthority(actorId: string) {
    return this.permissions.hasPermission(actorId, ...BLANKET_LEAVE_PERMISSION);
  }

  // M24 spec §5 — VIEW rute dozvoljavaju i ownership (sopstveni dosije), ne samo
  // M24/employee-record/VIEW. Poziva se iz kontrolera PRE poziva servisne metode.
  async assertCanView(userId: string, actorId: string) {
    if (actorId === userId) return;
    const allowed = await this.permissions.hasPermission(actorId, 'M24', 'employee-record', 'VIEW');
    if (!allowed) {
      throw new ForbiddenException('Nema dozvolu M24/employee-record/VIEW');
    }
  }

  getEmployeeRecord(userId: string) {
    return this.prisma.employeeRecord.findUnique({
      where: { userId },
      include: { trainingCertifications: true },
    });
  }

  // PATCH radi upsert (isti obrazac kao AgencySettings — nema posebnog "kreiraj" koraka za
  // korisnika koji dosad nije imao HR dosije, formular se prosto prvi put čuva).
  async upsertEmployeeRecord(userId: string, dto: UpsertEmployeeRecordDto, actorId: string) {
    const data = {
      employmentType: dto.employmentType,
      contractBasis: dto.contractBasis,
      hireDate: new Date(dto.hireDate),
      probationEndDate: dto.probationEndDate ? new Date(dto.probationEndDate) : null,
      contractEndDate: dto.contractEndDate ? new Date(dto.contractEndDate) : null,
      terminationDate: dto.terminationDate ? new Date(dto.terminationDate) : null,
      reportsToUserId: dto.reportsToUserId ?? null,
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

  // M24 spec §3a — zaposleni traži SOPSTVENO odsustvo (ownership, bez dozvole) ILI nosilac
  // M24/leave-record/CREATE traži u ime nekog drugog. Uvek nastaje kao PENDING — HR unos više
  // NIJE automatski odobren (razlika od v1.2).
  async createLeaveRecord(userId: string, dto: CreateLeaveRecordDto, actorId: string) {
    if (actorId !== userId) {
      const allowed = await this.hasBlanketLeaveAuthority(actorId);
      if (!allowed) {
        throw new ForbiddenException(
          'Nemate dozvolu da podnesete zahtev u ime drugog zaposlenog (M24/leave-record/CREATE).',
        );
      }
    }

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
        status: 'PENDING',
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
      action: 'leave-record.requested',
      resourceType: 'LeaveRecord',
      resourceId: leave.id,
      afterState: leave,
      context: { userId },
    });
    return leave;
  }

  // M24 spec §3a — odobravalac je EmployeeRecord.reportsToUserId TOG zaposlenog (ownership,
  // bez dozvole) ILI nosilac M24/leave-record/CREATE (blanket, isti obrazac kao VIEW_ALL — M1
  // §3.9a).
  private async assertCanDecide(
    leave: { employeeRecord: { reportsToUserId: string | null } },
    actorId: string,
  ) {
    if (leave.employeeRecord.reportsToUserId === actorId) return;
    const allowed = await this.hasBlanketLeaveAuthority(actorId);
    if (!allowed) {
      throw new ForbiddenException(
        'Nemate ovlašćenje da odlučite o ovom zahtevu — niste neposredni rukovodilac, niti nosilac M24/leave-record/CREATE.',
      );
    }
  }

  private async loadLeaveForDecision(leaveId: string) {
    const leave = await this.prisma.leaveRecord.findUniqueOrThrow({
      where: { id: leaveId },
      include: { employeeRecord: true },
    });
    if (leave.status !== 'PENDING') {
      throw new BadRequestException('Zahtev je već obrađen (nije više na čekanju).');
    }
    return leave;
  }

  async approveLeaveRecord(leaveId: string, actorId: string) {
    const leave = await this.loadLeaveForDecision(leaveId);
    await this.assertCanDecide(leave, actorId);

    const after = await this.prisma.leaveRecord.update({
      where: { id: leaveId },
      data: { status: 'APPROVED', approvedByUserId: actorId, approvedAt: new Date() },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M24',
      action: 'leave-record.approved',
      resourceType: 'LeaveRecord',
      resourceId: leaveId,
      beforeState: { status: leave.status },
      afterState: { status: after.status },
      context: { employeeRecordId: leave.employeeRecordId },
    });
    return after;
  }

  async rejectLeaveRecord(leaveId: string, reason: string, actorId: string) {
    if (!reason?.trim()) {
      throw new BadRequestException('Razlog odbijanja je obavezan.');
    }
    const leave = await this.loadLeaveForDecision(leaveId);
    await this.assertCanDecide(leave, actorId);

    const after = await this.prisma.leaveRecord.update({
      where: { id: leaveId },
      data: {
        status: 'REJECTED',
        approvedByUserId: actorId,
        approvedAt: new Date(),
        rejectionReason: reason.trim(),
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M24',
      action: 'leave-record.rejected',
      resourceType: 'LeaveRecord',
      resourceId: leaveId,
      beforeState: { status: leave.status },
      afterState: { status: after.status, rejectionReason: after.rejectionReason },
      context: { employeeRecordId: leave.employeeRecordId },
    });
    return after;
  }

  // M24 spec §2.2a (predlog v1.5) — dodeljeni dani PO GODINI. Ownership/dozvole isti kao
  // EmployeeRecord (VIEW/EDIT preko §4), poziva se posle assertCanView u kontroleru.
  async listLeaveEntitlements(userId: string) {
    const record = await this.prisma.employeeRecord.findUnique({ where: { userId } });
    if (!record) return [];
    return this.prisma.leaveEntitlement.findMany({
      where: { employeeRecordId: record.id },
      orderBy: { year: 'desc' },
    });
  }

  async upsertLeaveEntitlement(
    userId: string,
    year: number,
    dto: UpsertLeaveEntitlementDto,
    actorId: string,
  ) {
    const record = await this.prisma.employeeRecord.findUnique({ where: { userId } });
    if (!record) {
      throw new BadRequestException(
        'HR dosije za ovog zaposlenog još nije popunjen — popunite osnovne podatke pre dodele dana godišnjeg odmora.',
      );
    }
    const data = {
      daysEntitled: dto.daysEntitled,
      carriedOverDays: dto.carriedOverDays ?? null,
      carriedOverExpiresAt: dto.carriedOverExpiresAt ? new Date(dto.carriedOverExpiresAt) : null,
      updatedByUserId: actorId,
    };
    const key = { employeeRecordId_year: { employeeRecordId: record.id, year } };
    const before = await this.prisma.leaveEntitlement.findUnique({ where: key });
    const after = await this.prisma.leaveEntitlement.upsert({
      where: key,
      update: data,
      create: { employeeRecordId: record.id, year, ...data },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M24',
      action: before ? 'leave-entitlement.updated' : 'leave-entitlement.created',
      resourceType: 'LeaveEntitlement',
      resourceId: after.id,
      beforeState: before ?? undefined,
      afterState: after,
      context: { userId, year },
    });
    return after;
  }

  // M24 spec §2.3 (dopunjeno predlogom v1.5) — preostali dani = (dodeljeno TE godine + preneto
  // iz prethodne ako rok nije prošao) − suma GODISNJI_ODMOR te iste godine gde status=APPROVED,
  // izračunato, ne čuvano polje (princip #1, jedan izvor istine). Bez LeaveEntitlement reda za
  // traženu godinu → "nije dodeljeno" (entitled=null), sistem ne pogađa broj iz prethodne godine.
  async getLeaveBalance(userId: string, year?: number) {
    const record = await this.prisma.employeeRecord.findUnique({ where: { userId } });
    if (!record) {
      return { entitled: null, used: 0, remaining: null };
    }
    const targetYear = year ?? new Date().getFullYear();
    const entitlement = await this.prisma.leaveEntitlement.findUnique({
      where: { employeeRecordId_year: { employeeRecordId: record.id, year: targetYear } },
    });
    if (!entitlement) {
      return { entitled: null, used: 0, remaining: null };
    }

    const carriedOverStillValid =
      entitlement.carriedOverDays != null &&
      (!entitlement.carriedOverExpiresAt || entitlement.carriedOverExpiresAt >= new Date());
    const entitled =
      entitlement.daysEntitled + (carriedOverStillValid ? entitlement.carriedOverDays! : 0);

    const yearStart = new Date(targetYear, 0, 1);
    const yearEnd = new Date(targetYear + 1, 0, 1);
    const usedRows = await this.prisma.leaveRecord.findMany({
      where: {
        employeeRecordId: record.id,
        type: 'GODISNJI_ODMOR',
        status: 'APPROVED',
        startDate: { gte: yearStart, lt: yearEnd },
      },
      select: { daysCount: true },
    });
    const used = usedRows.reduce((sum, r) => sum + r.daysCount, 0);
    return { entitled, used, remaining: entitled - used };
  }

  // M24 spec §3b — timski kalendar. APPROVED vidljivo svima (bez `note` van kruga koji sme da
  // vidi pun zapis), PENDING samo actor-relevantnim licima (podnosilac/odobravalac/blanket).
  async getTeamCalendar(actorId: string, from: string, to: string, branchId?: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const dateOverlap = { startDate: { lte: toDate }, endDate: { gte: fromDate } };
    const branchFilter = branchId ? { employeeRecord: { user: { branchId } } } : {};
    const include = {
      employeeRecord: {
        include: { user: { select: { id: true, fullName: true, branchId: true } } },
      },
    } as const;

    const hasBlanket = await this.hasBlanketLeaveAuthority(actorId);

    const approvedRows = await this.prisma.leaveRecord.findMany({
      where: { status: 'APPROVED', ...dateOverlap, ...branchFilter },
      include,
      orderBy: { startDate: 'asc' },
    });

    const pendingWhere = hasBlanket
      ? { status: 'PENDING' as const, ...dateOverlap, ...branchFilter }
      : {
          status: 'PENDING' as const,
          ...dateOverlap,
          ...branchFilter,
          OR: [
            { recordedByUserId: actorId },
            { employeeRecord: { reportsToUserId: actorId } },
            { employeeRecord: { userId: actorId } },
          ],
        };
    const pendingRows = await this.prisma.leaveRecord.findMany({
      where: pendingWhere,
      include,
      orderBy: { startDate: 'asc' },
    });

    // `note` je vidljiva samo licima koja bi inače smela da vide pun zapis — sopstveni,
    // rukovodilac, ili nosilac blanket ovlašćenja (M24 spec §3b).
    const canSeeNote = (row: (typeof approvedRows)[number]) =>
      hasBlanket ||
      row.employeeRecord.userId === actorId ||
      row.employeeRecord.reportsToUserId === actorId;

    const toEntry = (row: (typeof approvedRows)[number]) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      startDate: row.startDate,
      endDate: row.endDate,
      daysCount: row.daysCount,
      note: canSeeNote(row) ? row.note : null,
      employee: { id: row.employeeRecord.user.id, fullName: row.employeeRecord.user.fullName },
    });

    return {
      approved: approvedRows.map(toEntry),
      pending: pendingRows.map(toEntry),
    };
  }
}
