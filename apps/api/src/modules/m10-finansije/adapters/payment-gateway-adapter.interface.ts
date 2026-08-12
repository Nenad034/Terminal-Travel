// M10 spec §7.1 — generički ugovor za sertifikovan PCI-DSS platni provajder (hosted checkout),
// isti obrazac kao ProviderAdapter u M4. Konkretan provajder bira se pri implementaciji (§12,
// otvoreno) — mi nikad ne vidimo/čuvamo broj kartice, samo token/referencu transakcije.

export type PaymentGatewayStatus = 'SUCCESS' | 'FAILED' | 'PENDING';

export interface InitiatePaymentResult {
  redirectUrl: string | null;
  clientToken: string | null;
  gatewayTransactionId: string;
}

export interface PaymentStatusResult {
  status: PaymentGatewayStatus;
  capturedAmount: number | null; // najmanja jedinica valute
}

export interface RefundOrVoidResult {
  status: 'REFUNDED' | 'VOIDED' | 'FAILED';
}

export interface PaymentGatewayAdapter {
  initiatePayment(amount: number, currency: string, idempotencyKey: string): Promise<InitiatePaymentResult>;
  getPaymentStatus(gatewayTransactionId: string): Promise<PaymentStatusResult>;
  refundOrVoid(gatewayTransactionId: string, amount: number): Promise<RefundOrVoidResult>;
}
