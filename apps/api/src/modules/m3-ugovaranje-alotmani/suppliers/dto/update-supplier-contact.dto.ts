import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SupplierContactStatus } from '@prisma/client';

// M3 spec §6 — linked_user_id se popunjava isključivo preko M19 toka, ne ovde.
export class UpdateSupplierContactDto {
  @IsString() @IsOptional() fullName?: string;
  @IsString() @IsOptional() phone?: string;
  @IsEnum(SupplierContactStatus) @IsOptional() status?: SupplierContactStatus;
}
