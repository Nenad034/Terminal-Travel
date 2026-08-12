import { IsString } from 'class-validator';

export class CreateFiscalDocumentDraftDto {
  @IsString()
  bookingId!: string;
}
