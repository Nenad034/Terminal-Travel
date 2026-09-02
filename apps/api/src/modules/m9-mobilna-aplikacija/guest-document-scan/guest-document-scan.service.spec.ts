import { GuestDocumentScanService } from './guest-document-scan.service';

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake-image-bytes'),
    ...overrides,
  } as Express.Multer.File;
}

function makeAnthropicResponse(json: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(json) }] };
}

function makeService(createImpl: (...args: any[]) => Promise<any>) {
  const auditLog = { write: jest.fn() };
  const anthropic = {
    isConfigured: jest.fn().mockReturnValue(true),
    getClient: jest.fn().mockReturnValue({ messages: { create: jest.fn(createImpl) } }),
  };
  const service = new GuestDocumentScanService(anthropic as any, auditLog as any);
  return { service, auditLog, anthropic };
}

// M15 spec §6.5.6e — strukturisana ekstrakcija, uvek AuditLogEntry, nikad izmišljena vrednost.
describe('GuestDocumentScanService', () => {
  it('vraća predpopunjena polja kad model uspešno prepozna dokument', async () => {
    const { service, auditLog } = makeService(async () =>
      makeAnthropicResponse({
        documentDetected: true,
        fullName: 'Petar Petrović',
        documentType: 'PASSPORT',
        documentNumber: 'P1234567',
        nationality: 'Srbija',
        dateOfBirth: '1990-05-12',
      }),
    );

    const result = await service.scan(makeFile(), 'user-1');

    expect(result).toEqual({
      documentDetected: true,
      fullName: 'Petar Petrović',
      documentType: 'PASSPORT',
      documentNumber: 'P1234567',
      nationality: 'Srbija',
      dateOfBirth: '1990-05-12',
      warning: undefined,
    });
    expect(auditLog.write).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'M9', action: 'guest_document_scan.attempted', actorId: 'user-1', context: { documentDetected: true, hadWarning: false } }),
    );
  });

  it('vraća prazna polja i upozorenje kad slika nije čitljiv dokument (documentDetected=false)', async () => {
    const { service } = makeService(async () => makeAnthropicResponse({ documentDetected: false }));

    const result = await service.scan(makeFile(), 'user-1');

    expect(result.documentDetected).toBe(false);
    expect(result.fullName).toBeNull();
    expect(result.warning).toContain('ne izgleda kao čitljiv putni dokument');
  });

  it('nikad ne izmišlja vrednost — polje koje nedostaje u odgovoru modela ostaje null uz upozorenje', async () => {
    const { service } = makeService(async () =>
      makeAnthropicResponse({
        documentDetected: true,
        fullName: 'Ana Anić',
        documentType: 'PASSPORT',
        documentNumber: null,
        nationality: 'Srbija',
        dateOfBirth: '1985-01-01',
      }),
    );

    const result = await service.scan(makeFile(), 'user-1');

    expect(result.documentNumber).toBeNull();
    expect(result.fullName).toBe('Ana Anić');
    expect(result.warning).toContain('Neka polja nisu pouzdano pročitana');
  });

  it('odbacuje datum rođenja u budućnosti umesto da ga prihvati', async () => {
    const futureYear = new Date().getFullYear() + 1;
    const { service } = makeService(async () =>
      makeAnthropicResponse({
        documentDetected: true,
        fullName: 'Test Test',
        documentType: 'PASSPORT',
        documentNumber: 'X1',
        nationality: 'Srbija',
        dateOfBirth: `${futureYear}-01-01`,
      }),
    );

    const result = await service.scan(makeFile(), 'user-1');

    expect(result.dateOfBirth).toBeNull();
    expect(result.warning).toBeDefined();
  });

  it('odbija nepodržan format slike pre poziva Anthropic-a', async () => {
    const { service, anthropic } = makeService(async () => makeAnthropicResponse({}));

    const result = await service.scan(makeFile({ mimetype: 'image/heic' }), 'user-1');

    expect(result.documentDetected).toBe(false);
    expect(result.warning).toContain('Nepodržan format');
    expect(anthropic.getClient).not.toHaveBeenCalled();
  });

  it('vraća graciozan fallback kad Anthropic poziv baci grešku (npr. mreža/limit)', async () => {
    const { service } = makeService(async () => {
      throw new Error('rate limited');
    });

    const result = await service.scan(makeFile(), 'user-1');

    expect(result.documentDetected).toBe(false);
    expect(result.warning).toContain('unesite podatke ručno');
  });

  it('vraća fallback bez poziva kad ANTHROPIC_API_KEY nije podešen', async () => {
    const { service, anthropic } = makeService(async () => makeAnthropicResponse({}));
    anthropic.isConfigured.mockReturnValue(false);

    const result = await service.scan(makeFile(), 'user-1');

    expect(result.warning).toContain('trenutno nije dostupno');
    expect(anthropic.getClient).not.toHaveBeenCalled();
  });

  it('skida ```json ogradu ako je model ipak doda uprkos uputstvu', async () => {
    const { service } = makeService(async () => ({
      content: [
        {
          type: 'text',
          text: '```json\n{"documentDetected": true, "fullName": "Iva Ivić", "documentType": "PASSPORT", "documentNumber": "P9", "nationality": "Srbija", "dateOfBirth": "2000-01-01"}\n```',
        },
      ],
    }));

    const result = await service.scan(makeFile(), 'user-1');

    expect(result.documentDetected).toBe(true);
    expect(result.fullName).toBe('Iva Ivić');
  });
});
