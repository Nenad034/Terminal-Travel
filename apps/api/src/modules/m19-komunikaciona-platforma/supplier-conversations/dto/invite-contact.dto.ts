import { IsUUID } from 'class-validator';

// M19 spec §9.2/§9.7 — POST /chat/supplier-conversations/:id/invite-contact. Referencira
// postojeći M3 SupplierContact (mora pripadati istom Conversation.supplierId).
export class InviteContactDto {
  @IsUUID()
  supplierContactId!: string;
}
