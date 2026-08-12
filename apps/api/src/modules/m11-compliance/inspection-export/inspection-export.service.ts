import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GenerateInspectionExportDto } from './dto/generate-inspection-export.dto';

export interface InspectionExportResult {
  periodFrom: string;
  periodTo: string;
  generatedAt: string;
  auditLogEntries: unknown[];
  bookings: unknown[];
  fiscalDocuments: unknown[];
  travelGuaranteeRegistrations: unknown[];
  csv: string;
}

// M11 spec §3 — ne uvodi se nova baza, agregira već postojeće podatke iz M1/M5/M10/M11 za
// zadati period, u formatu čitljivom za turističkog inspektora. Format ostaje JSON + CSV
// (CSV se otvara u Excel-u) dok se sa vlasnikom ne potvrdi konkretna PDF/XLSX biblioteka
// (CLAUDE.md — nema nove tehnologije bez potvrde vlasnika); vidi "Otvoreno za dalje" M11 spec.
@Injectable()
export class InspectionExportService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(dto: GenerateInspectionExportDto): Promise<InspectionExportResult> {
    const from = new Date(dto.periodFrom);
    const to = new Date(dto.periodTo);

    const [auditLogEntries, bookings, fiscalDocuments, travelGuaranteeRegistrations] = await Promise.all([
      this.prisma.auditLogEntry.findMany({ where: { timestamp: { gte: from, lte: to } }, orderBy: { timestamp: 'asc' } }),
      this.prisma.booking.findMany({ where: { createdAt: { gte: from, lte: to } }, orderBy: { createdAt: 'asc' } }),
      this.prisma.fiscalDocument.findMany({ where: { createdAt: { gte: from, lte: to } }, orderBy: { createdAt: 'asc' } }),
      this.prisma.travelGuaranteeRegistration.findMany({ where: { createdAt: { gte: from, lte: to } }, orderBy: { createdAt: 'asc' } }),
    ]);

    return {
      periodFrom: dto.periodFrom,
      periodTo: dto.periodTo,
      generatedAt: new Date().toISOString(),
      auditLogEntries,
      bookings,
      fiscalDocuments,
      travelGuaranteeRegistrations,
      csv: this.toCsv(bookings, fiscalDocuments, travelGuaranteeRegistrations),
    };
  }

  private toCsv(
    bookings: { bookingNumber: string; status: string; tipNastupanja: string; totalPrice: number; currency: string; createdAt: Date }[],
    fiscalDocuments: { id: string; documentType: string; status: string; externalReference: string | null; amountRsd: number }[],
    registrations: { bookingId: string; status: string; cisRegistrationNumber: string | null }[],
  ): string {
    const lines: string[] = [];
    lines.push('== Rezervacije ==');
    lines.push('booking_number,status,tip_nastupanja,total_price,currency,created_at');
    for (const b of bookings) {
      lines.push(`${b.bookingNumber},${b.status},${b.tipNastupanja},${b.totalPrice},${b.currency},${b.createdAt.toISOString()}`);
    }
    lines.push('');
    lines.push('== Fiskalni dokumenti ==');
    lines.push('id,document_type,status,external_reference,amount_rsd');
    for (const f of fiscalDocuments) {
      lines.push(`${f.id},${f.documentType},${f.status},${f.externalReference ?? ''},${f.amountRsd}`);
    }
    lines.push('');
    lines.push('== Registracije garancije putovanja (CIS) ==');
    lines.push('booking_id,status,cis_registration_number');
    for (const r of registrations) {
      lines.push(`${r.bookingId},${r.status},${r.cisRegistrationNumber ?? ''}`);
    }
    return lines.join('\n');
  }
}
