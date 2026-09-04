import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { ProviderError, ProviderErrorCode } from '../../modules/m4-integracije-api/provider-adapter.interface';

/**
 * M4 spec §3.2 definiše sedam normalizovanih vrsta greške provajdera, ali `ProviderError`
 * nasleđuje obični `Error`, ne `HttpException` — bez ovog filtera svaka od njih izlazi kao
 * `{"statusCode":500,"message":"Internal server error"}` i pozivalac ne može da razlikuje
 * uredan ishod („hotel je pun") od kvara („pogrešni pristupni podaci"). Vidi zamku 13.4.
 *
 * Zašto filter, a ne pretvaranje u `HttpException` na mestu bacanja: `ProviderError` se baca i
 * u putanjama koje NE idu preko HTTP-a (M5 zove `IntegrationsService` direktno kroz ubrizgavanje
 * zavisnosti i sam hvata grešku po `code`) — servisni sloj ne sme da zna za HTTP statuse.
 * Prevod se radi isključivo na granici ka HTTP-u, isti obrazac kao `PrismaExceptionFilter`.
 *
 * `providerErrorCode` se UVEK vraća u telu odgovora. Statusni kod je gruba podela za posrednike
 * (proxy, retry sloj), a tačna vrsta ostaje u telu — pozivalac koji hoće da razlikuje
 * `NO_AVAILABILITY` od `INVALID_REQUEST` grana po tom polju, ne po statusu.
 */
const STATUS_BY_CODE: Record<ProviderErrorCode, number> = {
  // Provajder nije odgovorio na vreme — mi smo posrednik koji je čekao uzalud.
  TIMEOUT: HttpStatus.GATEWAY_TIMEOUT, // 504
  // Prekoračen dozvoljen broj poziva kod provajdera; pozivalac sme da pokuša kasnije.
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS, // 429
  // NAŠI pristupni podaci su pogrešni/istekli — nije greška pozivaoca, nego naše konfiguracije.
  AUTH_FAILED: HttpStatus.BAD_GATEWAY, // 502
  // Provajder je odbio sadržaj zahteva — jedini slučaj u kom je pozivalac zaista pogrešio.
  INVALID_REQUEST: HttpStatus.BAD_REQUEST, // 400
  // Uredan poslovni ishod, ne kvar: traženo postoji ali nije slobodno u tom terminu.
  NO_AVAILABILITY: HttpStatus.CONFLICT, // 409
  // Provajder ne radi ili je „osigurač" otvoren posle niza grešaka — privremeno stanje.
  PROVIDER_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE, // 503
  // Neprepoznat odgovor provajdera — svesno 502, ne 500: kvar je na spoljnoj strani, ne kod nas.
  UNKNOWN: HttpStatus.BAD_GATEWAY, // 502
};

@Catch(ProviderError)
export class ProviderExceptionFilter implements ExceptionFilter {
  catch(exception: ProviderError, host: ArgumentsHost) {
    const status = STATUS_BY_CODE[exception.code] ?? HttpStatus.BAD_GATEWAY;
    const response = host.switchToHttp().getResponse();
    response.status(status).json({
      message: exception.message,
      error: 'Provider Error',
      statusCode: status,
      providerErrorCode: exception.code,
    });
  }
}
