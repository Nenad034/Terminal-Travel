// M4 spec §2.2 — pluggable strategije po dobavljaču.

export interface OutgoingRequest {
  headers: Record<string, string>;
  body?: Record<string, unknown>;
}

export type AuthStrategyType = 'API_KEY' | 'BASIC' | 'OAUTH2_CLIENT_CREDENTIALS' | 'REQUEST_SIGNING' | 'SESSION_TOKEN';

export interface AuthStrategy {
  strategyType: AuthStrategyType;
  applyAuth(request: OutgoingRequest): OutgoingRequest;
  refreshIfNeeded(): Promise<void>;
}
