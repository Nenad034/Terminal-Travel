import { IsString, Length } from 'class-validator';

export class MfaVerifyDto {
  @IsString()
  mfaToken!: string; // privremeni token izdat posle uspešne lozinke, pre potvrde TOTP-a

  @IsString()
  @Length(6, 6)
  code!: string;
}
