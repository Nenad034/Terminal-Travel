import { findDateMismatches } from './date-mismatch';

describe('findDateMismatches (M5 spec §3.0e.3a)', () => {
  it('prazan niz kad nema i PREVOZ i BORAVAK stavki', () => {
    const result = findDateMismatches([
      { productId: 'h1', type: 'ACCOMMODATION', stayFrom: '2027-01-05', stayTo: '2027-01-12' },
    ]);
    expect(result.mismatched).toEqual([]);
  });

  it('flag-uje let čiji datum uopšte ne pada u opseg boravka', () => {
    const result = findDateMismatches([
      { productId: 'f1', type: 'FLIGHT', stayFrom: '2027-02-01', stayTo: '2027-02-01' },
      { productId: 'h1', type: 'ACCOMMODATION', stayFrom: '2027-01-05', stayTo: '2027-01-12' },
    ]);
    expect(result.mismatched.map((m) => m.productId)).toEqual(['f1']);
  });

  it('ne flag-uje let dan pre useljenja (tolerancija 1 dan)', () => {
    const result = findDateMismatches([
      { productId: 'f1', type: 'FLIGHT', stayFrom: '2027-01-04', stayTo: '2027-01-04' },
      { productId: 'h1', type: 'ACCOMMODATION', stayFrom: '2027-01-05', stayTo: '2027-01-12' },
    ]);
    expect(result.mismatched).toEqual([]);
  });

  it('ne flag-uje transfer koji pada unutar perioda boravka', () => {
    const result = findDateMismatches([
      { productId: 't1', type: 'TRANSFER', stayFrom: '2027-01-05', stayTo: '2027-01-05' },
      { productId: 'h1', type: 'ACCOMMODATION', stayFrom: '2027-01-05', stayTo: '2027-01-12' },
    ]);
    expect(result.mismatched).toEqual([]);
  });

  it('dva hotela u različitim terminima bez ijedne PREVOZ stavke se ne proveravaju (namerno van obima)', () => {
    const result = findDateMismatches([
      { productId: 'h1', type: 'ACCOMMODATION', stayFrom: '2027-01-05', stayTo: '2027-01-12' },
      { productId: 'h2', type: 'ACCOMMODATION', stayFrom: '2027-03-01', stayTo: '2027-03-08' },
    ]);
    expect(result.mismatched).toEqual([]);
  });
});
