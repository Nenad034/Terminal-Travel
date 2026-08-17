import { audienceToPermissionSegment, resolveHelpAudience } from './audience-context';

// M21 spec §2.3/§5.2 — resolveHelpAudience je JEDINA funkcija koja izvodi audience_context iz
// pozivaoca. avgust 2026 (vlasnikova odluka, M15 spec §11 "B2C_SITE omnisearch dopuna") dodaje
// PUBLIC_GUEST: anoniman posetilac (userId=null) i logovan GUEST bez LEGAL_ENTITY veze
// (INDIVIDUAL ili nepovezan) — ranije `null` (van obima v1), sad sopstvena, uža publika.
describe('resolveHelpAudience (M21 spec §2.3, avgust 2026 PUBLIC_GUEST dopuna)', () => {
  function makePrisma() {
    return {
      user: { findUnique: jest.fn() },
      clientAccount: { findUnique: jest.fn() },
    };
  }

  it('userId=null (potpuno anoniman B2C posetilac) vraća PUBLIC_GUEST bez ijednog upita nad bazom', async () => {
    const prisma = makePrisma();
    const audience = await resolveHelpAudience(prisma as any, null);
    expect(audience).toBe('PUBLIC_GUEST');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.clientAccount.findUnique).not.toHaveBeenCalled();
  });

  it('STAFF nalog vraća STAFF (nema regresije)', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
    expect(await resolveHelpAudience(prisma as any, 'u1')).toBe('STAFF');
  });

  it('SUBAGENT_CONTACT nalog vraća SUBAGENT (nema regresije)', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ accountType: 'SUBAGENT_CONTACT', linkedProfileId: null });
    expect(await resolveHelpAudience(prisma as any, 'u2')).toBe('SUBAGENT');
  });

  it('GUEST povezan sa LEGAL_ENTITY ClientAccount vraća BUSINESS_CLIENT (nema regresije)', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'ca1' });
    prisma.clientAccount.findUnique.mockResolvedValue({ accountType: 'LEGAL_ENTITY' });
    expect(await resolveHelpAudience(prisma as any, 'u3')).toBe('BUSINESS_CLIENT');
  });

  it('GUEST povezan sa INDIVIDUAL ClientAccount vraća PUBLIC_GUEST (avgust 2026 — ranije null)', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'ca2' });
    prisma.clientAccount.findUnique.mockResolvedValue({ accountType: 'INDIVIDUAL' });
    expect(await resolveHelpAudience(prisma as any, 'u4')).toBe('PUBLIC_GUEST');
  });

  it('GUEST bez povezanog ClientAccount (linkedProfileId=null) vraća PUBLIC_GUEST', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: null });
    expect(await resolveHelpAudience(prisma as any, 'u5')).toBe('PUBLIC_GUEST');
    expect(prisma.clientAccount.findUnique).not.toHaveBeenCalled();
  });

  it('nalog bez rešive publike (npr. SUPPLIER_CONTACT) i dalje vraća null', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ accountType: 'SUPPLIER_CONTACT', linkedProfileId: null });
    expect(await resolveHelpAudience(prisma as any, 'u6')).toBeNull();
  });

  it('nepostojeći User vraća null', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    expect(await resolveHelpAudience(prisma as any, 'ne-postoji')).toBeNull();
  });
});

describe('audienceToPermissionSegment', () => {
  it('mapira sve četiri publike na svoj segment, uključujući PUBLIC_GUEST → public', () => {
    expect(audienceToPermissionSegment('STAFF')).toBe('staff');
    expect(audienceToPermissionSegment('SUBAGENT')).toBe('subagent');
    expect(audienceToPermissionSegment('BUSINESS_CLIENT')).toBe('business');
    expect(audienceToPermissionSegment('PUBLIC_GUEST')).toBe('public');
  });
});
