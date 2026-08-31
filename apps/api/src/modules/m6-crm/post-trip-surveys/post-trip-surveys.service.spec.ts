import { PostTripSurveysService } from './post-trip-surveys.service';

// M6 spec §9 dopuna (31.8.2026, M1 §3.9a konvencija) — VIEW_ALL vidljivost za findMany.
// Ostatak servisa (submit/google-review/sendDueSurveys) nije pokriven ovde — ovaj fajl je
// fokusiran isključivo na novi mehanizam, isti obrazac kao ostali M1 §3.9a testovi ovog prolaza.
describe('PostTripSurveysService — findMany VIEW_ALL (§9 dopuna, 31.8.2026)', () => {
  function makeService() {
    const prisma: any = {
      postTripSurvey: { findMany: jest.fn() },
    };
    const reviewConfig = { get: jest.fn() };
    const permissions = { hasPermission: jest.fn().mockResolvedValue(true) };
    const service = new PostTripSurveysService(prisma, reviewConfig as any, permissions as any);
    return { service, prisma, permissions };
  }

  it('bez actorUserId (pozadinski poziv) ne filtrira po vlasništvu', async () => {
    const { service, prisma } = makeService();
    prisma.postTripSurvey.findMany.mockResolvedValue([]);

    await service.findMany({});

    expect(prisma.postTripSurvey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ booking: undefined }) }),
    );
  });

  it('STAFF sa VIEW_ALL=true vidi sve, bez booking filtera', async () => {
    const { service, prisma, permissions } = makeService();
    permissions.hasPermission.mockResolvedValue(true);
    prisma.postTripSurvey.findMany.mockResolvedValue([]);

    await service.findMany({}, 'staff-1');

    expect(prisma.postTripSurvey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ booking: undefined }) }),
    );
  });

  it('STAFF sužen (VIEW_ALL=false) filtrira na booking vlasništvo/zaduženje', async () => {
    const { service, prisma, permissions } = makeService();
    permissions.hasPermission.mockResolvedValue(false);
    prisma.postTripSurvey.findMany.mockResolvedValue([]);

    await service.findMany({}, 'staff-1');

    expect(prisma.postTripSurvey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ booking: { OR: [{ ownerId: 'staff-1' }, { assignedToId: 'staff-1' }] } }),
      }),
    );
  });
});
