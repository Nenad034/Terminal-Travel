import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AllotmentMode } from '@prisma/client';

/**
 * M3 spec §2.3d (v1.16, 8.9.2026) — izmena postojećeg perioda.
 *
 * Do ove verzije period se mogao samo napraviti: postojao je `POST .../periods` i `PUT` za
 * pod-resurse (cene, otkazivanja, ponude, dodatne usluge, taksa), ali nijedan endpoint nad
 * samim periodom. Dozvola `M3/contract-period/EDIT` je pri tom stajala u spec §5 od prve
 * verzije — bez ijednog pozivaoca. Posledica u praksi: pogrešno unet kapacitet, datum ili tip
 * sobe nije se mogao ispraviti kroz aplikaciju.
 *
 * Sva polja su opciona — šalje se samo ono što se menja (PATCH semantika). `null` se razlikuje
 * od izostavljenog: izostavljeno = ne diraj, `null` = obriši vrednost (npr. skini rok povrata).
 */
export class UpdateContractPeriodDto {
  @IsDateString()
  @IsOptional()
  stayFrom?: string;

  @IsDateString()
  @IsOptional()
  stayTo?: string;

  @IsString()
  @IsOptional()
  roomType?: string;

  @IsEnum(AllotmentMode)
  @IsOptional()
  allotmentMode?: AllotmentMode;

  @IsInt()
  @Min(0)
  @IsOptional()
  totalCapacity?: number | null;

  @IsInt()
  @Min(0)
  @IsOptional()
  releaseDaysBefore?: number | null;

  @IsInt()
  @Min(0)
  @IsOptional()
  ukupnaFiksnaObaveza?: number | null;

  @IsString()
  @IsOptional()
  fixedObligationCurrency?: string | null;

  @IsInt()
  @Min(1)
  @IsOptional()
  minStayNights?: number | null;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxStayNights?: number | null;

  /**
   * §2.3d — smanjenje kapaciteta ispod već prodatog je DOZVOLJENO (vlasnikova odluka
   * 8.9.2026: dešava se u praksi, dobavljač smanji kontingent a gosti su već u knjigama),
   * ali nikad slučajno: bez ove zastavice zahtev se odbija sa prebrojanom porukom koliko
   * jedinica ostaje bez pokrića, pa pozivalac (ekran ili AI agent, §4.4.2 ograda 5) mora
   * svesno da potvrdi drugi put.
   */
  @IsOptional()
  confirmOversold?: boolean;
}
