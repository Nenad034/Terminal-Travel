import { IsIn, IsUUID } from 'class-validator';

// M22 spec §2.2 — POST /mailboxes/:id/access, zahteva M22/mailbox-access/GRANT.
export class GrantMailboxAccessDto {
  @IsUUID()
  userId!: string;

  @IsIn(['VIEW', 'REPLY'])
  accessLevel!: 'VIEW' | 'REPLY';
}
