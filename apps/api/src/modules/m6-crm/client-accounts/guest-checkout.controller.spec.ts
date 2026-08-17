import { GuestCheckoutController } from './guest-checkout.controller';

// Kontroler test — delegacija. Stvarno ponašanje rate limita (5/sat po IP) je
// live-provereno protiv running dev servera (nije jedinično testabilno bez
// pokretanja pravog ThrottlerGuard/storage-a) — vidi izveštaj sesije.
describe('GuestCheckoutController', () => {
  it('delegira na GuestCheckoutService.checkout', async () => {
    const guestCheckout: any = { checkout: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'b' }) };
    const controller = new GuestCheckoutController(guestCheckout);
    const dto = { fullName: 'Ana Anić', email: 'ana@example.com' };

    const result = await controller.checkout(dto as any);

    expect(guestCheckout.checkout).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ accessToken: 'a', refreshToken: 'b' });
  });
});
