import { MockContractDocumentGeneratorAdapter } from './mock-contract-document-generator.adapter';

describe('MockContractDocumentGeneratorAdapter (M20 spec §8)', () => {
  it('vraća sintetički documentUrl koji sadrži contractType', async () => {
    const adapter = new MockContractDocumentGeneratorAdapter();

    const result = await adapter.generate({ contractType: 'ORGANIZOVANO_PUTOVANJE', contentSnapshot: {} });

    expect(result.documentUrl).toContain('ORGANIZOVANO_PUTOVANJE');
  });
});
