import { IsIn, IsUUID } from 'class-validator';

// M22 spec §3.1a/§8 — POST /threads/:id/link-supplier-announcement, zahteva REPLY (M22 §7).
// Upisuje ISKLJUČIVO EmailThread.related_supplier_manifest_id/related_supplier_change_notice_id
// (weak ref, predlog/potvrda veze) — NIKAD ne poziva M5 SupplierChangeNoticesController.
// confirmSupplier() niti bilo koji drugi M5 servis. Konačna M5 potvrda ostaje isključivo
// ljudski klik na M5/supplier-confirmation/CONFIRM, van ovog modula.
export class LinkSupplierAnnouncementDto {
  @IsIn(['SUPPLIER_MANIFEST', 'SUPPLIER_CHANGE_NOTICE'])
  announcementType!: 'SUPPLIER_MANIFEST' | 'SUPPLIER_CHANGE_NOTICE';

  @IsUUID()
  announcementId!: string;
}
