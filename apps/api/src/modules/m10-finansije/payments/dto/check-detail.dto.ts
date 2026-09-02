import { IsDateString, IsInt, IsString, Min } from 'class-validator';

// M10 spec §5.2 dopuna (2.9.2026) — jedan red "specifikacije čekova". Vidi `PaymentCheckDetail`
// u schema.prisma za obrazloženje zašto je ovo lista, ne pojedinačna polja na Payment-u.
export class CheckDetailDto {
  @IsString()
  bankId!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsString()
  checkNumber!: string;

  @IsDateString()
  clearanceDate!: string;
}
