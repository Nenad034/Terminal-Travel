import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { AnnouncementTriggerCondition } from '@prisma/client';

// M5 spec §8.7/§11 — POST/PATCH /supplier-announcement-rules.
export class UpsertAnnouncementRuleDto {
  @IsString()
  @IsOptional()
  supplierId?: string; // izostavljeno/null = podrazumevano pravilo

  @IsEnum(AnnouncementTriggerCondition)
  triggerCondition!: AnnouncementTriggerCondition;

  @IsInt()
  @IsOptional()
  daysBeforeStay?: number;
}
