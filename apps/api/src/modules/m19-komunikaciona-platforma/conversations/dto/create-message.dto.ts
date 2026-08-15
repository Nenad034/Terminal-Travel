import { IsString, MinLength } from 'class-validator';

// M19 spec §8 — POST /chat/conversations/:id/messages (REST fallback/istorija; WS
// `message.send` je primaran kanal za novo slanje, isti oblik tela).
export class CreateMessageDto {
  @IsString()
  @MinLength(1)
  body!: string;
}
