import { isSelfServiceChannel, resolveTipNastupanja } from './tip-nastupanja';

describe('resolveTipNastupanja (M5 spec §4.0a)', () => {
  it('vraća vrednost kad se svi kandidati slažu', () => {
    expect(resolveTipNastupanja(['ORGANIZATOR', 'ORGANIZATOR'])).toEqual({ resolved: 'ORGANIZATOR', conflicting: false });
  });

  it('prijavljuje sukob kad se kandidati ne slažu', () => {
    expect(resolveTipNastupanja(['ORGANIZATOR', 'POSREDNIK']).conflicting).toBe(true);
  });

  it('prijavljuje sukob kad bar jedna stavka nema podrazumevanu vrednost', () => {
    expect(resolveTipNastupanja(['ORGANIZATOR', null]).conflicting).toBe(true);
  });

  it('radi za jednu stavku', () => {
    expect(resolveTipNastupanja(['POSREDNIK'])).toEqual({ resolved: 'POSREDNIK', conflicting: false });
  });
});

describe('isSelfServiceChannel', () => {
  it('B2C_SITE/MOBILE/B2B_PORTAL su samouslužni', () => {
    expect(isSelfServiceChannel('B2C_SITE')).toBe(true);
    expect(isSelfServiceChannel('MOBILE')).toBe(true);
    expect(isSelfServiceChannel('B2B_PORTAL')).toBe(true);
  });

  it('INTERNAL_PANEL/PHONE nisu samouslužni', () => {
    expect(isSelfServiceChannel('INTERNAL_PANEL')).toBe(false);
    expect(isSelfServiceChannel('PHONE')).toBe(false);
  });
});
