import { Injectable } from '@nestjs/common';
import type {
  InitiatePaymentResult,
  PaymentGatewayAdapter,
  PaymentStatusResult,
  RefundOrVoidResult,
} from './payment-gateway-adapter.interface';

// M10 spec §7.1 — Mock implementacija dok se ne izabere stvaran PCI-DSS provajder (§12, otvoreno).
// Scriptable za testove: setNextStatus() menja ishod sledećeg initiatePayment poziva.
@Injectable()
export class MockPaymentGatewayAdapter implements PaymentGatewayAdapter {
  private readonly byIdempotencyKey = new Map<string, string>();
  private readonly transactions = new Map<string, { amount: number; status: PaymentStatusResult['status'] }>();
  private nextStatus: PaymentStatusResult['status'] = 'SUCCESS';

  setNextStatus(status: PaymentStatusResult['status']): void {
    this.nextStatus = status;
  }

  async initiatePayment(amount: number, _currency: string, idempotencyKey: string): Promise<InitiatePaymentResult> {
    // §7.2 korak 1 — isti idempotency_key mora vratiti istu transakciju, ne duplu naplatu.
    const existing = this.byIdempotencyKey.get(idempotencyKey);
    if (existing) {
      return { redirectUrl: null, clientToken: `mock-token-${existing}`, gatewayTransactionId: existing };
    }

    const gatewayTransactionId = `mock-txn-${idempotencyKey}`;
    this.byIdempotencyKey.set(idempotencyKey, gatewayTransactionId);
    this.transactions.set(gatewayTransactionId, { amount, status: this.nextStatus });

    return { redirectUrl: null, clientToken: `mock-token-${gatewayTransactionId}`, gatewayTransactionId };
  }

  async getPaymentStatus(gatewayTransactionId: string): Promise<PaymentStatusResult> {
    const txn = this.transactions.get(gatewayTransactionId);
    if (!txn) return { status: 'FAILED', capturedAmount: null };
    return { status: txn.status, capturedAmount: txn.status === 'SUCCESS' ? txn.amount : null };
  }

  async refundOrVoid(gatewayTransactionId: string, _amount: number): Promise<RefundOrVoidResult> {
    const txn = this.transactions.get(gatewayTransactionId);
    if (!txn) return { status: 'FAILED' };
    this.transactions.delete(gatewayTransactionId);
    return { status: 'VOIDED' };
  }
}
