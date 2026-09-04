import { IsString, Length } from 'class-validator';

// M1 spec §5/§6 (dopuna 4.9.2026) — prvo podešavanje 2FA. `setupToken` je JWT tipa
// `mfa_setup_pending` koji `POST /auth/login` vraća kad je lozinka tačna a obavezna 2FA
// još nije uključena; nijedan drugi guard ga ne prihvata kao pristupni token.
export class StartMfaSetupDto {
  @IsString()
  setupToken!: string;
}

export class ConfirmMfaSetupDto {
  @IsString()
  setupToken!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
