import { signPaymentWebhookPayload, verifyPaymentWebhookSignature } from './payment-webhook-signature';

// M10 spec §7.2 — bezbednosni nalaz 28.8.2026: webhook mora odbiti poziv bez ispravnog potpisa,
// inače bilo ko ko sazna/izračuna gatewayTransactionId može lažno potvrditi rezervaciju kao plaćenu.
describe('payment webhook signature', () => {
  const secret = 'test-secret';

  it('prihvata ispravan potpis', () => {
    const signature = signPaymentWebhookPayload('mock-txn-abc', secret);
    expect(verifyPaymentWebhookSignature('mock-txn-abc', signature, secret)).toBe(true);
  });

  it('odbija nedostajući potpis', () => {
    expect(verifyPaymentWebhookSignature('mock-txn-abc', undefined, secret)).toBe(false);
  });

  it('odbija potpis izračunat sa pogrešnim tajnim ključem (npr. napadač bez pristupa .env)', () => {
    const signature = signPaymentWebhookPayload('mock-txn-abc', 'pogresan-kljuc');
    expect(verifyPaymentWebhookSignature('mock-txn-abc', signature, secret)).toBe(false);
  });

  it('odbija potpis za drugi gatewayTransactionId (izračunat za tuđu transakciju)', () => {
    const signature = signPaymentWebhookPayload('mock-txn-drugi', secret);
    expect(verifyPaymentWebhookSignature('mock-txn-abc', signature, secret)).toBe(false);
  });
});
