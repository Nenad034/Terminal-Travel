import { GuestCheckoutService } from './guest-checkout.service';

// M8 spec poglavlje 3, korak 3 / §9a dopuna (avgust 2026) — "nastavi kao gost bez
// naloga". Provera da GuestCheckoutService (a) prosleđuje tačna polja ka
// AuthService.register (b) NIKAD ne prosleđuje gostu izabranu/vidljivu lozinku —
// svaki poziv generiše sopstvenu slučajnu vrednost.
describe('GuestCheckoutService', () => {
  function makeService() {
    const authService: any = { register: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'b' }) };
    const service = new GuestCheckoutService(authService);
    return { service, authService };
  }

  it('poziva AuthService.register sa fullName/email/phone i slučajnom lozinkom', async () => {
    const { service, authService } = makeService();

    const result = await service.checkout({ fullName: 'Petar Petrović', email: 'petar@example.com', phone: '+381601234567' });

    expect(authService.register).toHaveBeenCalledTimes(1);
    const dto = authService.register.mock.calls[0][0];
    expect(dto.fullName).toBe('Petar Petrović');
    expect(dto.email).toBe('petar@example.com');
    expect(dto.phone).toBe('+381601234567');
    expect(typeof dto.password).toBe('string');
    expect(dto.password.length).toBeGreaterThanOrEqual(12); // RegisterDto.MinLength(12)
    expect(result).toEqual({ accessToken: 'a', refreshToken: 'b' });
  });

  it('generiše različitu lozinku pri svakom pozivu (nikad ista/predvidiva vrednost)', async () => {
    const { service, authService } = makeService();

    await service.checkout({ fullName: 'A', email: 'a@example.com' });
    await service.checkout({ fullName: 'B', email: 'b@example.com' });

    const [firstDto] = authService.register.mock.calls[0];
    const [secondDto] = authService.register.mock.calls[1];
    expect(firstDto.password).not.toBe(secondDto.password);
  });

  it('radi bez phone (opciono polje)', async () => {
    const { service, authService } = makeService();

    await service.checkout({ fullName: 'Bez Telefona', email: 'notel@example.com' });

    const dto = authService.register.mock.calls[0][0];
    expect(dto.phone).toBeUndefined();
  });
});
