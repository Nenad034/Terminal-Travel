import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';
import { ConversationsService } from '../conversations/conversations.service';
import { AccessTokenPayload } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';

// M19 spec §3/§8 — WS namespace /ws/chat. Prvi WebSocket kod u repozitorijumu (nema postojećeg
// presedana, standardni NestJS Gateway obrazac — vlasnik potvrdio @nestjs/websockets + socket.io,
// avgust 2026). JWT provera u handleConnection ručno poziva JwtService.verify (isto što
// JwtAuthGuard radi za HTTP, §3.7 — access token nosi samo sub/sessionId) jer standardni Nest
// Guard-ovi ne rade nad WS handshake kontekstom bez dodatnog adaptera — ručna provera je
// jednostavnija i dovoljna za prvi prolaz.
@WebSocketGateway({ namespace: '/ws/chat', cors: { origin: '*' } })
export class ChatGatewayService implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGatewayService.name);
  // userId -> broj otvorenih socket konekcija (više tabova/uređaja) — OFFLINE se upisuje tek
  // kad poslednja konekcija tog korisnika padne, ne na svaki pojedinačni disconnect.
  private readonly connectionsByUser = new Map<string, Set<string>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
    private readonly conversations: ConversationsService,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    const token = this.extractToken(socket);
    if (!token) {
      socket.disconnect(true);
      return;
    }

    let payload: AccessTokenPayload;
    try {
      payload = this.jwt.verify<AccessTokenPayload>(token);
    } catch {
      socket.disconnect(true);
      return;
    }

    socket.data.userId = payload.sub;
    const existing = this.connectionsByUser.get(payload.sub) ?? new Set<string>();
    const wasOffline = existing.size === 0;
    existing.add(socket.id);
    this.connectionsByUser.set(payload.sub, existing);

    // §9.7 — SUPPLIER_CONTACT se povezuje istim protokolom, ograničen serverski na sopstveni
    // conversation_id preko istog participant upisa koji već štiti REST (ConversationParticipant),
    // nema posebnog case-a ovde — samo se pridružuje sobama gde JESTE učesnik (ispod).
    const memberships = await this.prisma.conversationParticipant.findMany({ where: { userId: payload.sub } });
    for (const m of memberships) {
      await socket.join(m.conversationId);
    }

    if (wasOffline) {
      await this.presence.setStatus(payload.sub, 'ONLINE');
      this.server.emit('presence.updated', { userId: payload.sub, status: 'ONLINE' });
    }
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    const userId: string | undefined = socket.data?.userId;
    if (!userId) return;

    const existing = this.connectionsByUser.get(userId);
    existing?.delete(socket.id);
    if (!existing || existing.size === 0) {
      this.connectionsByUser.delete(userId);
      await this.presence.setStatus(userId, 'OFFLINE');
      this.server.emit('presence.updated', { userId, status: 'OFFLINE' });
    }
  }

  // §8 — `message.send`: upisuje preko ConversationsService (isti put kao REST fallback, spec
  // §3 "nema gubitka poruka") i emituje `message.new` svim povezanim učesnicima sobe.
  @SubscribeMessage('message.send')
  async handleMessageSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId: string; body: string },
  ): Promise<void> {
    const userId: string | undefined = socket.data?.userId;
    if (!userId) return;

    try {
      const message = await this.conversations.createMessage(body.conversationId, { body: body.body }, userId);
      this.server.to(body.conversationId).emit('message.new', message);
    } catch (err) {
      socket.emit('message.error', { conversationId: body.conversationId, error: (err as Error).message });
    }
  }

  // §2.4/§8 — efemerno, nikad upisano u bazu.
  @SubscribeMessage('typing.start')
  handleTypingStart(@ConnectedSocket() socket: Socket, @MessageBody() body: { conversationId: string }): void {
    const userId: string | undefined = socket.data?.userId;
    if (!userId) return;
    socket.to(body.conversationId).emit('typing.started', { conversationId: body.conversationId, userId });
  }

  @SubscribeMessage('typing.stop')
  handleTypingStop(@ConnectedSocket() socket: Socket, @MessageBody() body: { conversationId: string }): void {
    const userId: string | undefined = socket.data?.userId;
    if (!userId) return;
    socket.to(body.conversationId).emit('typing.stopped', { conversationId: body.conversationId, userId });
  }

  // §2.4 — eksplicitan klijent-signal (ne cron) za AWAY.
  @SubscribeMessage('presence.away')
  async handlePresenceAway(@ConnectedSocket() socket: Socket): Promise<void> {
    const userId: string | undefined = socket.data?.userId;
    if (!userId) return;
    await this.presence.setStatus(userId, 'AWAY');
    this.server.emit('presence.updated', { userId, status: 'AWAY' });
  }

  @SubscribeMessage('presence.active')
  async handlePresenceActive(@ConnectedSocket() socket: Socket): Promise<void> {
    const userId: string | undefined = socket.data?.userId;
    if (!userId) return;
    await this.presence.setStatus(userId, 'ONLINE');
    this.server.emit('presence.updated', { userId, status: 'ONLINE' });
  }

  private extractToken(socket: Socket): string | null {
    const authToken = socket.handshake.auth?.token as string | undefined;
    if (authToken) return authToken;
    const header = socket.handshake.headers?.authorization;
    if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
    return null;
  }
}
