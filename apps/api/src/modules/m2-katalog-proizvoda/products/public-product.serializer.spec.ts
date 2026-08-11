import { toPublicProduct } from './public-product.serializer';

describe('toPublicProduct (M2 spec §5.1 — identitet dobavljača se nikad ne izlaže B2C/B2B)', () => {
  it('uklanja source_type/source_contract_id/source_provider/source_external_id iz payload-a', () => {
    const internal = {
      id: 'p1',
      sourceType: 'CONTRACTED',
      sourceContractId: 'contract-1',
      sourceProvider: 'travelgate',
      sourceExternalId: 'ext-123',
      destinationCountry: 'Srbija',
      destinationCity: 'Beograd',
    };

    const result = toPublicProduct(internal);

    expect(result).not.toHaveProperty('sourceType');
    expect(result).not.toHaveProperty('sourceContractId');
    expect(result).not.toHaveProperty('sourceProvider');
    expect(result).not.toHaveProperty('sourceExternalId');
    expect(JSON.stringify(result)).not.toContain('travelgate');
    expect(JSON.stringify(result)).not.toContain('ext-123');
  });

  it('čuva sva ostala polja (naziv proizvoda i lokacija smeju ostati vidljivi)', () => {
    const internal = {
      id: 'p1',
      sourceType: 'API',
      sourceContractId: null,
      sourceProvider: 'travelgate',
      sourceExternalId: 'ext-123',
      destinationCountry: 'Srbija',
      destinationCity: 'Beograd',
    };

    const result = toPublicProduct(internal);

    expect(result).toEqual({ id: 'p1', destinationCountry: 'Srbija', destinationCity: 'Beograd' });
  });
});
