import { MockPaymentGatewayAdapter } from './mock-payment-gateway.adapter';

describe('MockPaymentGatewayAdapter (M10 spec §7.2 — idempotentnost)', () => {
  it('vraća istu gatewayTransactionId za isti idempotencyKey — sprečava duplu naplatu', async () => {
    const adapter = new MockPaymentGatewayAdapter();

    const first = await adapter.initiatePayment(100000, 'EUR', 'key-1');
    const second = await adapter.initiatePayment(100000, 'EUR', 'key-1');

    expect(second.gatewayTransactionId).toBe(first.gatewayTransactionId);
  });

  it('vraća različite gatewayTransactionId za različite idempotencyKey', async () => {
    const adapter = new MockPaymentGatewayAdapter();

    const first = await adapter.initiatePayment(100000, 'EUR', 'key-1');
    const second = await adapter.initiatePayment(100000, 'EUR', 'key-2');

    expect(second.gatewayTransactionId).not.toBe(first.gatewayTransactionId);
  });

  it('refundOrVoid uklanja transakciju — naknadni getPaymentStatus vraća FAILED', async () => {
    const adapter = new MockPaymentGatewayAdapter();
    const { gatewayTransactionId } = await adapter.initiatePayment(100000, 'EUR', 'key-1');

    await adapter.refundOrVoid(gatewayTransactionId, 100000);
    const status = await adapter.getPaymentStatus(gatewayTransactionId);

    expect(status.status).toBe('FAILED');
  });
});
