import { EmailAiAssistantService } from './email-ai-assistant.service';

describe('EmailAiAssistantService (M22 spec §4)', () => {
  function makeService(anthropicConfigured: boolean, mockResponseText: string) {
    const prisma = {
      emailMessage: { update: jest.fn(), create: jest.fn() },
      aIAgent: { findFirst: jest.fn().mockResolvedValue({ id: 'agent-1', userId: 'agent-user-1', modelTier: 'LIGHT' }) },
    };
    const auditLog = { write: jest.fn() };
    const anthropic = {
      isConfigured: jest.fn().mockReturnValue(anthropicConfigured),
      getClient: jest.fn().mockReturnValue({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [{ type: 'text', text: mockResponseText }],
            usage: { input_tokens: 10, output_tokens: 20 },
          }),
        },
      }),
    };
    const invocationLog = { record: jest.fn() };
    const service = new EmailAiAssistantService(prisma as any, auditLog as any, anthropic as any, invocationLog as any);
    return { service, prisma, auditLog, anthropic, invocationLog };
  }

  const inboundMessage = { id: 'msg-1', threadId: 'thread-1', body: '', toAddresses: ['rezervacije@tt.rs'], fromAddress: 'gost@primer.rs' } as any;

  it('nacrt koji model vrati kao "spreman za slanje" ali pominje cenu OSTAJE sentBy=null (odbrambeni sloj na nivou koda, ne samo prompt)', async () => {
    const { service, prisma } = makeService(
      true,
      'SAŽETAK: Gost pita za cenu aranžmana.\nNACRT: Poštovani, cena je 500 EUR po osobi, možete odmah uplatiti.',
    );
    const message = { ...inboundMessage, body: 'Koja je cena za ovaj aranžman?' };

    await service.processInboundMessage(message);

    expect(prisma.emailMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          senderType: 'AI_DRAFT',
          sentBy: null,
          body: expect.stringContaining('[Napomena AI agenta:'),
        }),
      }),
    );
  });

  it('nacrt bez osetljivih pojmova i dalje ostaje sentBy=null pri kreiranju (jedini put ka sentBy je ljudski klik)', async () => {
    const { service, prisma } = makeService(true, 'SAŽETAK: Gost pozdravlja tim.\nNACRT: Poštovani, hvala na poruci.');
    const message = { ...inboundMessage, body: 'Samo pozdrav timu.' };

    await service.processInboundMessage(message);

    expect(prisma.emailMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ senderType: 'AI_DRAFT', sentBy: null }) }),
    );
  });

  it('uvek upisuje aiSummary na originalnu INBOUND poruku kad je model konfigurisan', async () => {
    const { service, prisma } = makeService(true, 'SAŽETAK: Kratak sažetak.\nNACRT: Nacrt odgovora.');
    const message = { ...inboundMessage, body: 'Neki tekst.' };

    await service.processInboundMessage(message);

    expect(prisma.emailMessage.update).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: { aiSummary: 'Kratak sažetak.' },
    });
  });

  it('graceful degradacija — bez ANTHROPIC_API_KEY ne baca grešku, samo bez sažetka/nacrta', async () => {
    const { service, prisma } = makeService(false, '');
    const message = { ...inboundMessage, body: 'Bilo šta.' };

    await expect(service.processInboundMessage(message)).resolves.not.toThrow();

    expect(prisma.emailMessage.update).not.toHaveBeenCalled();
    expect(prisma.emailMessage.create).not.toHaveBeenCalled();
  });

  it('loguje AuditLogEntry sa actor_type=AI_AGENT za svaku obradu', async () => {
    const { service, auditLog } = makeService(true, 'SAŽETAK: s\nNACRT: n');
    const message = { ...inboundMessage, body: 'tekst' };

    await service.processInboundMessage(message);

    expect(auditLog.write).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: 'AI_AGENT', module: 'M22', action: 'email.summarize-draft' }),
    );
  });
});
