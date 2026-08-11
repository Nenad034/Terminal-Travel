import { decryptSecret, encryptSecret, generateRawToken, hashToken } from './secret-box';

describe('secret-box (M1 spec §3.1/§3.7 — enkripcija MFA sekreta, heš tokena)', () => {
  const ORIGINAL_ENV = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-not-for-production';
  });

  afterAll(() => {
    process.env.ENCRYPTION_KEY = ORIGINAL_ENV;
  });

  describe('encryptSecret / decryptSecret', () => {
    it('vraća originalan tekst posle enkripcije pa dekripcije', () => {
      const plain = 'JBSWY3DPEHPK3PXP'; // primer TOTP secreta
      const encrypted = encryptSecret(plain);
      expect(decryptSecret(encrypted)).toBe(plain);
    });

    it('ne čuva secret u plain obliku — enkriptovan izlaz se razlikuje od ulaza', () => {
      const plain = 'JBSWY3DPEHPK3PXP';
      expect(encryptSecret(plain)).not.toBe(plain);
    });

    it('koristi nasumičan IV — dve enkripcije istog teksta daju različit ciphertext', () => {
      const plain = 'JBSWY3DPEHPK3PXP';
      const a = encryptSecret(plain);
      const b = encryptSecret(plain);
      expect(a).not.toBe(b);
      // ali obe se ispravno dekriptuju nazad
      expect(decryptSecret(a)).toBe(plain);
      expect(decryptSecret(b)).toBe(plain);
    });

    it('baca grešku ako ENCRYPTION_KEY nije podešen u okruženju', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => encryptSecret('bilo šta')).toThrow(/ENCRYPTION_KEY/);
    });

    it('dekripcija sa pogrešnim ključem ne uspeva (auth tag provera AES-GCM)', () => {
      const encrypted = encryptSecret('tajna-vrednost');
      process.env.ENCRYPTION_KEY = 'drugi-potpuno-drugaciji-kljuc';
      expect(() => decryptSecret(encrypted)).toThrow();
    });
  });

  describe('hashToken', () => {
    it('je deterministički — isti ulaz uvek daje isti heš', () => {
      expect(hashToken('isti-token')).toBe(hashToken('isti-token'));
    });

    it('različiti ulazi daju različite heševe', () => {
      expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
    });

    it('nikad ne vraća sirov ulaz (M1 spec §3.7 — čuva se heš, ne sirov token)', () => {
      const raw = 'moj-refresh-token-vrednost';
      expect(hashToken(raw)).not.toBe(raw);
    });
  });

  describe('generateRawToken', () => {
    it('generiše token dovoljne dužine/entropije (64 hex karaktera = 32 bajta)', () => {
      const token = generateRawToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('svaki poziv generiše različit token', () => {
      const tokens = new Set(Array.from({ length: 20 }, () => generateRawToken()));
      expect(tokens.size).toBe(20);
    });
  });
});
