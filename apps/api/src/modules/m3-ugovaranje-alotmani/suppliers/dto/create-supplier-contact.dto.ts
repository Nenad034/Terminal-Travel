import { IsEmail, IsString } from 'class-validator';

// M3 spec §2.1a
export class CreateSupplierContactDto {
  @IsString()
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  phone!: string;
}
