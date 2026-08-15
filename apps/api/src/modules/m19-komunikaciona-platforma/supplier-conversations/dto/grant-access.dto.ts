import { IsUUID } from 'class-validator';

// M19 spec §9.4/§9.7 — POST /chat/supplier-conversations/:id/access.
export class GrantAccessDto {
  @IsUUID()
  userId!: string;
}
