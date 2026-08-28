import { createHmac, timingSafeEqual } from 'crypto';

// M10 spec §7.2 (dopuna 28.8.2026, bezbednosni nalaz — pre lansiranja pregled) — `POST
// /finance/payments/card/webhook` namerno nema M1 auth (provajder nema naš token, isti
// obrazac kao svaki pravi PSP webhook), ali je zato MORALO da ima potpis — bez njega, bilo ko
// ko sazna/izračuna `gatewayTransactionId` (danas deterministički iz `quoteId` u MOCK adapteru,
// `mock-payment-gateway.adapter.ts`) mogao je da potvrdi TUĐU/SVOJU rezervaciju kao plaćenu bez
// ijednog dinara — mock `getPaymentStatus` uvek vraća SUCCESS. Ovo je isti princip kao potpis
// svakog pravog PSP webhook-a (Stripe/CorvusPay/...) — kad se provajder izabere (§12), njegov
// adapter zamenjuje ovaj deljeni-tajni-ključ HMAC sopstvenom šemom potpisa, ne dodaje se pored.
export function signPaymentWebhookPayload(gatewayTransactionId: string, secret: string): string {
  return createHmac('sha256', secret).update(gatewayTransactionId).digest('hex');
}

export function verifyPaymentWebhookSignature(gatewayTransactionId: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = signPaymentWebhookPayload(gatewayTransactionId, secret);
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
