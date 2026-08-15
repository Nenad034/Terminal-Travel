import { ChatGatewayService } from './chat-gateway.service';

// M19 spec §3/§8 — jedinični test na ChatGateway sa mock socket-ima (NestJS testing utilities za
// gateway), NE pun e2e WS klijent u ovom prolazu (dokumentovano ograničenje, spec §11/plan
// implementacije: "WS integracioni test zahteva pravi socket.io klijent... veći rizik/vreme za
// prvi prolaz").
describe('ChatGatewayService', () => {
  function makeSocket(overrides: Partial<any> = {}) {
    return {
      id: 'socket-1',
      data: {},
      handshake: { auth: {}, headers: {} },
      disconnect: jest.fn(),
      join: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      ...overrides,
    };
  }

  function makeGateway() {
    const jwt = { verify: jest.fn() };
    const prisma = { conversationParticipant: { findMany: jest.fn().mockResolvedValue([]) } };
    const presence = { setStatus: jest.fn() };
    const conversations = { createMessage: jest.fn() };
    const gateway = new ChatGatewayService(jwt as any, prisma as any, presence as any, conversations as any);
    gateway.server = { emit: jest.fn(), to: jest.fn().mockReturnValue({ emit: jest.fn() }) } as any;
    return { gateway, jwt, prisma, presence, conversations };
  }

  describe('handleConnection (M19 spec §3 — JWT provera, isti sadržaj tokena kao HTTP)', () => {
    it('diskonektuje socket bez tokena', async () => {
      const { gateway } = makeGateway();
      const socket = makeSocket();

      await gateway.handleConnection(socket as any);

      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('diskonektuje socket sa nevažećim tokenom', async () => {
      const { gateway, jwt } = makeGateway();
      jwt.verify.mockImplementation(() => {
        throw new Error('invalid');
      });
      const socket = makeSocket({ handshake: { auth: { token: 'bad-token' }, headers: {} } });

      await gateway.handleConnection(socket as any);

      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('pridružuje socket svim ConversationParticipant sobama i postavlja ONLINE', async () => {
      const { gateway, jwt, prisma, presence } = makeGateway();
      jwt.verify.mockReturnValue({ sub: 'staff-1', sessionId: 's1' });
      prisma.conversationParticipant.findMany.mockResolvedValue([{ conversationId: 'c1' }, { conversationId: 'c2' }]);
      const socket = makeSocket({ handshake: { auth: { token: 'good-token' }, headers: {} } });

      await gateway.handleConnection(socket as any);

      expect(socket.join).toHaveBeenCalledWith('c1');
      expect(socket.join).toHaveBeenCalledWith('c2');
      expect(presence.setStatus).toHaveBeenCalledWith('staff-1', 'ONLINE');
      expect(gateway.server.emit).toHaveBeenCalledWith('presence.updated', { userId: 'staff-1', status: 'ONLINE' });
    });

    it('drugi tab istog korisnika ne šalje ponovo presence.updated (ostaje ONLINE)', async () => {
      const { gateway, jwt, presence } = makeGateway();
      jwt.verify.mockReturnValue({ sub: 'staff-1', sessionId: 's1' });
      const firstSocket = makeSocket({ id: 'socket-1', handshake: { auth: { token: 't' }, headers: {} } });
      const secondSocket = makeSocket({ id: 'socket-2', handshake: { auth: { token: 't' }, headers: {} } });

      await gateway.handleConnection(firstSocket as any);
      await gateway.handleConnection(secondSocket as any);

      expect(presence.setStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleDisconnect (M19 spec §2.4)', () => {
    it('postavlja OFFLINE tek kad padne poslednja konekcija korisnika', async () => {
      const { gateway, jwt, presence } = makeGateway();
      jwt.verify.mockReturnValue({ sub: 'staff-1', sessionId: 's1' });
      const firstSocket = makeSocket({ id: 'socket-1', handshake: { auth: { token: 't' }, headers: {} } });
      const secondSocket = makeSocket({ id: 'socket-2', handshake: { auth: { token: 't' }, headers: {} } });
      await gateway.handleConnection(firstSocket as any);
      await gateway.handleConnection(secondSocket as any);

      await gateway.handleDisconnect(firstSocket as any);
      expect(presence.setStatus).toHaveBeenCalledTimes(1); // samo ONLINE od pre, ni jedan OFFLINE još

      await gateway.handleDisconnect(secondSocket as any);
      expect(presence.setStatus).toHaveBeenCalledWith('staff-1', 'OFFLINE');
    });
  });

  describe('message.send (M19 spec §3/§8)', () => {
    it('upisuje preko ConversationsService i emituje message.new sobi', async () => {
      const { gateway, conversations } = makeGateway();
      const message = { id: 'm1', conversationId: 'c1', body: 'zdravo' };
      conversations.createMessage.mockResolvedValue(message);
      const roomEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({ emit: roomEmit });
      const socket = makeSocket({ data: { userId: 'staff-1' } });

      await gateway.handleMessageSend(socket as any, { conversationId: 'c1', body: 'zdravo' });

      expect(conversations.createMessage).toHaveBeenCalledWith('c1', { body: 'zdravo' }, 'staff-1');
      expect(gateway.server.to).toHaveBeenCalledWith('c1');
      expect(roomEmit).toHaveBeenCalledWith('message.new', message);
    });

    it('emituje message.error pozivaocu ako ConversationsService odbije (npr. nije učesnik)', async () => {
      const { gateway, conversations } = makeGateway();
      conversations.createMessage.mockRejectedValue(new Error('Razgovor c1 nije pronađen.'));
      const socket = makeSocket({ data: { userId: 'staff-1' } });

      await gateway.handleMessageSend(socket as any, { conversationId: 'c1', body: 'zdravo' });

      expect(socket.emit).toHaveBeenCalledWith('message.error', expect.objectContaining({ conversationId: 'c1' }));
    });
  });

  describe('typing.start/typing.stop (M19 spec §2.4 — efemerno, ne piše u bazu)', () => {
    it('prosleđuje typing.started ostalima u sobi, ne pošiljaocu', () => {
      const { gateway } = makeGateway();
      const socket = makeSocket({ data: { userId: 'staff-1' } });

      gateway.handleTypingStart(socket as any, { conversationId: 'c1' });

      expect(socket.to).toHaveBeenCalledWith('c1');
    });
  });
});
