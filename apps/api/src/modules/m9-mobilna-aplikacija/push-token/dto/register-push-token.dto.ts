import { IsNotEmpty, IsString } from 'class-validator';

// M9 spec §5 v1.4 — POST /mobile/push-token, bilo koja mobilna uloga (gost ili vodič).
export class RegisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  pushToken!: string;
}
