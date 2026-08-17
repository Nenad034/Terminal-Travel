import { Injectable } from '@nestjs/common';
import { AuthService } from '../../m1-core-identitet/auth/auth.service';
import { generateRawToken } from '../../../common/crypto/secret-box';
import { GuestCheckoutDto } from './dto/guest-checkout.dto';

/**
 * M8 spec poglavlje 3, korak 3 / §9a dopuna (avgust 2026) — "nastavi kao gost bez
 * naloga". Otkriveno pri implementaciji: M5 (`POST /sales/quotes`, `/confirm`) i
 * ostatak samouslužnog toka zahtevaju važeći JWT jer `PermissionsGuard` proverava
 * ulogu uživo nad bazom (M1 spec §3.6) — nema mehanizma za potpuno anonimnu
 * (bez ijednog User zapisa) potvrdu rezervacije bez menjanja M5 bezbednosnog
 * modela, što je van obima ove ciljane M6 dopune. Zato ovaj endpoint ne pravi
 * "goli" ClientAccount, već ponovo koristi već testiran M1 `AuthService.register`
 * put (koji već, preko `user.registered.guest` event-a, automatski pravi
 * `ClientAccount{account_type: INDIVIDUAL}` — M6EventSubscribersService) sa
 * SLUČAJNO generisanom lozinkom koju gost nikad ne vidi niti bira — sa njegove
 * tačke gledišta ovo je "nastavi bez naloga", ne registracija. `ClientAccount.
 * linked_user_id` (M6 spec §2.1) ostaje prazan kao i kod svake druge registracije
 * danas (to polje nijedan postojeći tok ne postavlja) — jedina razlika od
 * "prave" registracije je što gost ne bira lozinku, pa nema mogućnost da se
 * kasnije prijavi istim putem (svaki sledeći "nastavi bez naloga" pravi nov nalog).
 */
@Injectable()
export class GuestCheckoutService {
  constructor(private readonly authService: AuthService) {}

  async checkout(dto: GuestCheckoutDto) {
    const randomPassword = generateRawToken();
    return this.authService.register({
      email: dto.email,
      password: randomPassword,
      fullName: dto.fullName,
      phone: dto.phone,
    });
  }
}
