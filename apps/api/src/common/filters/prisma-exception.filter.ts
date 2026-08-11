import { ArgumentsHost, Catch, ExceptionFilter, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * `findUniqueOrThrow`/`findFirstOrThrow` bacaju `PrismaClientKnownRequestError` (P2025)
 * kad zapis ne postoji — bez ovog filtera Nest bi to tretirao kao neočekivanu grešku
 * (500), ne kao "nije pronađeno" (404). Zajednička infrastruktura, ne specifično za
 * jedan modul — svaki modul koji koristi *OrThrow oslanja se na ovo.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    if (exception.code === 'P2025') {
      const response = host.switchToHttp().getResponse();
      const body = new NotFoundException('Zapis nije pronađen').getResponse();
      response.status(404).json(body);
      return;
    }
    throw exception;
  }
}
