import { SupplierManifestsService } from './supplier-manifests.service';
import { SupplierChangeNoticesService } from './supplier-change-notices.service';

// M5 spec §8.4 (dopuna 5.9.2026) — dok. 39 nalaz 1.2.
//
// Zašto baš ovi testovi: greška koju hvataju nije bila pad ni izuzetak — sve je „radilo", samo
// je baza tvrdila da je hotel obavešten kad nije. Takva greška ne postoji nigde osim u ISHODU
// upisa, pa je jedini način da se zaključa da se proveri šta se tačno upisuje kad isporuke
// nema. Bez ovoga bi svaka buduća izmena mogla tiho da vrati bezuslovno `status: 'SENT'`.
describe('Slanje dobavljaču ne sme da tvrdi isporuku koje nije bilo (M5 §8.4)', () => {
  function makeManifestService(delivered: boolean) {
    const manifest = {
      id: 'man-1',
      status: 'DRAFT',
      supplierId: 'sup-1',
      referenceCode: 'TT-000123',
      documentUrl: null,
      items: [{ bookingItemId: 'bi-1' }, { bookingItemId: 'bi-2' }],
    };
    const prisma: any = {
      supplierManifest: { findUnique: jest.fn().mockResolvedValue(manifest), update: jest.fn(async ({ data }: any) => ({ ...manifest, ...data })) },
      supplier: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'sup-1', name: 'Hotel Vila', contactEmail: 'hotel@example.com' }) },
      bookingItem: { updateMany: jest.fn() },
      $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
    };
    const auditLog = { write: jest.fn() };
    const mailbox = { sendViaSharedMailbox: jest.fn().mockResolvedValue({ delivered, reason: delivered ? undefined : 'nema sandučeta', emailThreadId: null }) };
    const service = new SupplierManifestsService(prisma, auditLog as any, mailbox as any);
    jest.spyOn(service, 'findOne').mockResolvedValue(manifest as any);
    return { service, prisma, auditLog };
  }

  it('kad poruka NIJE isporučena: status je PENDING_SEND, sentAt ostaje prazan, a stavke se NE označavaju kao najavljene', async () => {
    const { service, prisma, auditLog } = makeManifestService(false);

    const updated = await service.send('man-1', 'user-1');

    expect(updated.status).toBe('PENDING_SEND');
    // Ovo je jezgro nalaza 1.2: `announced_at` je ono što ostatak sistema koristi da zna šta je
    // najavljeno. Da se upiše bez stvarnog slanja, stavke bi nestale iz svake provere
    // „šta još nije najavljeno" — a hotel ne bi znao ništa.
    expect(prisma.bookingItem.updateMany).not.toHaveBeenCalled();
    const written = prisma.supplierManifest.update.mock.calls[0][0].data;
    expect(written.sentAt).toBeUndefined();
    expect(written.sentBy).toBe('user-1'); // ko je pokušao se ipak beleži
    // Revizijski trag mora da razlikuje pokušaj od slanja.
    expect(auditLog.write.mock.calls[0][0].action).toBe('supplier_manifest.send_pending');
  });

  it('kad je poruka isporučena: status je SENT, sentAt i announced_at se upisuju', async () => {
    const { service, prisma, auditLog } = makeManifestService(true);

    const updated = await service.send('man-1', 'user-1');

    expect(updated.status).toBe('SENT');
    expect(prisma.bookingItem.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.supplierManifest.update.mock.calls[0][0].data.sentAt).toBeInstanceOf(Date);
    expect(auditLog.write.mock.calls[0][0].action).toBe('supplier_manifest.sent');
  });

  it('lista u PENDING_SEND sme da se pošalje ponovo (kad provajder proradi), SENT ne sme', async () => {
    const { service } = makeManifestService(true);
    jest.spyOn(service, 'findOne').mockResolvedValue({
      id: 'man-1', status: 'PENDING_SEND', supplierId: 'sup-1', referenceCode: 'TT-000123', documentUrl: null, items: [],
    } as any);
    await expect(service.send('man-1', 'user-1')).resolves.toBeDefined();

    jest.spyOn(service, 'findOne').mockResolvedValue({
      id: 'man-1', status: 'SENT', supplierId: 'sup-1', referenceCode: 'TT-000123', documentUrl: null, items: [],
    } as any);
    await expect(service.send('man-1', 'user-1')).rejects.toThrow(/nije u statusu DRAFT ni PENDING_SEND/);
  });
});

describe('SupplierChangeNotice — isto pravilo (M5 §8.4/§8.8)', () => {
  function makeNoticeService(delivered: boolean) {
    const notice = { id: 'notice-1', status: 'DRAFT', referenceCode: 'TT-000456', noticeType: 'CANCELLATION' };
    const prisma: any = {
      supplierChangeNotice: { findUnique: jest.fn().mockResolvedValue(notice), update: jest.fn(async ({ data }: any) => ({ ...notice, ...data })) },
    };
    const auditLog = { write: jest.fn() };
    const mailbox = { sendViaSharedMailbox: jest.fn().mockResolvedValue({ delivered, emailThreadId: null }) };
    return { service: new SupplierChangeNoticesService(prisma, auditLog as any, mailbox as any), prisma, auditLog };
  }

  it('neisporučen storno ostaje PENDING_SEND bez sentAt — pa ga §8.6 ne može ni greškom „potvrditi"', async () => {
    const { service, prisma } = makeNoticeService(false);

    const updated = await service.send('notice-1', 'hotel@example.com', 'user-1');

    expect(updated.status).toBe('PENDING_SEND');
    expect(prisma.supplierChangeNotice.update.mock.calls[0][0].data.sentAt).toBeUndefined();
  });

  it('isporučen storno prelazi u SENT sa sentAt', async () => {
    const { service, prisma } = makeNoticeService(true);

    const updated = await service.send('notice-1', 'hotel@example.com', 'user-1');

    expect(updated.status).toBe('SENT');
    expect(prisma.supplierChangeNotice.update.mock.calls[0][0].data.sentAt).toBeInstanceOf(Date);
  });
});
