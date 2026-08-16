import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

// M22 spec §2.1 — POST /mailboxes, zahteva M22/mailbox/CREATE.
export class CreateMailboxDto {
  @IsEmail()
  address!: string;

  @IsString()
  displayName!: string;

  @IsIn(['SHARED', 'PERSONAL'])
  mailboxType!: 'SHARED' | 'PERSONAL';

  @IsOptional()
  @IsUUID()
  ownerUserId?: string; // samo za PERSONAL — MailboxesService.create auto-upisuje REPLY (§2.2)

  @IsString()
  providerConnectionRef!: string; // mock — realno prost string u ovom prolazu (§10)

  // M5 spec §8.8 — najviše jedan Mailbox sme nositi ovu oznaku (sprovedeno u servisu).
  @IsOptional()
  @IsBoolean()
  isSupplierUnifiedInbox?: boolean;
}
