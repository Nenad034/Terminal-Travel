import { Injectable } from '@nestjs/common';
import { MCPClientRegistration } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { hashToken } from '../../../common/crypto/secret-box';

export interface McpAuthResult {
  registration: MCPClientRegistration;
  /** Oblik koji @modelcontextprotocol/server očekuje kao AuthInfo (token/clientId/scopes). */
  authInfo: { token: string; clientId: string; scopes: string[] };
}

/**
 * M16 spec §3.1/§10 — prvi prolaz: jednostavan unapred-deljen ključ (Bearer = plaintext
 * kredencijal izdat pri POST /mcp-admin/clients), poređenje preko heša — isti obrazac kao
 * RefreshToken. Pun OAuth 2.1 authorization server je otvorena stavka (spec §10 dopuna).
 * MCP protokol authorizaciju tretira kao opcionu i ne zahteva ništa više od ovoga da bi
 * server bio spec-usaglašen (2026-07-28, poglavlje "Authorization Server" — OPTIONAL).
 */
@Injectable()
export class McpAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async verify(bearerToken: string): Promise<McpAuthResult | null> {
    const registration = await this.prisma.mCPClientRegistration.findUnique({
      where: { credentialsEncrypted: hashToken(bearerToken) },
    });
    if (!registration || registration.status !== 'ACTIVE') return null;
    return {
      registration,
      authInfo: { token: bearerToken, clientId: registration.id, scopes: [registration.accessLevel] },
    };
  }
}
