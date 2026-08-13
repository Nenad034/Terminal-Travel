import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { createMcpHandler, McpHttpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { McpAuthService } from './mcp-auth.service';
import { McpRateLimiterService } from './mcp-rate-limiter.service';
import { McpServerFactoryService } from './mcp-server.factory';

/**
 * M16 spec §8 — sam MCP server, protokol verzije 2026-07-28 (stateless, JSON-RPC preko
 * @modelcontextprotocol/server v2). Autentikacija/rate-limit se rade OVDE, pre nego što
 * zahtev uopšte stigne do `handler.fetch` — SDK sam "ne radi verifikaciju tokena"
 * (createMcpHandler dokumentacija), pass-through dizajn, isti obrazac kao svaki drugi
 * OAuthTokenVerifier korisnik.
 */
@ApiExcludeController()
@Controller('mcp')
export class McpController {
  private readonly handler: McpHttpHandler;

  constructor(
    private readonly auth: McpAuthService,
    private readonly rateLimiter: McpRateLimiterService,
    factory: McpServerFactoryService,
  ) {
    this.handler = createMcpHandler(factory.build());
  }

  @All()
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    if (!token) {
      res
        .status(401)
        .set('WWW-Authenticate', 'Bearer')
        .json({ jsonrpc: '2.0', error: { code: -32001, message: 'Nedostaje Bearer token (M16 spec §3.1).' } });
      return;
    }

    const result = await this.auth.verify(token);
    if (!result) {
      res
        .status(401)
        .set('WWW-Authenticate', 'Bearer')
        .json({ jsonrpc: '2.0', error: { code: -32001, message: 'Nevažeći ili neaktivan MCP kredencijal.' } });
      return;
    }

    if (!this.rateLimiter.tryConsume(result.registration.id, result.registration.rateLimitPerMinute)) {
      res
        .status(429)
        .json({ jsonrpc: '2.0', error: { code: -32000, message: 'Prekoračen rate_limit_per_minute (M16 spec §6).' } });
      return;
    }

    // `req.auth` je jedini način da AuthInfo stigne do ctx.authInfo u factory-ju —
    // toNodeHandler ga prosleđuje kao pass-through (@modelcontextprotocol/node, toNodeHandler.d.ts).
    (req as Request & { auth?: unknown }).auth = result.authInfo;
    const nodeHandler = toNodeHandler(this.handler);
    await nodeHandler(req, res, req.body);
  }
}
