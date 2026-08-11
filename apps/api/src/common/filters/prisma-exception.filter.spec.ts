import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

function makeHost(response: { status: jest.Mock; json: jest.Mock }) {
  return { switchToHttp: () => ({ getResponse: () => response }) } as any;
}

describe('PrismaExceptionFilter', () => {
  it('mapira P2025 (RecordNotFound) na HTTP 404', () => {
    const filter = new PrismaExceptionFilter();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const exception = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.22.0',
    });

    filter.catch(exception, makeHost({ status, json }));

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  it('prosleđuje dalje greške koje nisu P2025 (ne guta ih tiho)', () => {
    const filter = new PrismaExceptionFilter();
    const exception = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.22.0',
    });

    expect(() => filter.catch(exception, makeHost({ status: jest.fn(), json: jest.fn() }))).toThrow(exception);
  });
});
