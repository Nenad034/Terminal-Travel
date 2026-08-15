import { IsBoolean } from 'class-validator';

// M21 spec §6 — POST /help/questions/:id/feedback (👍/👎).
export class FeedbackQuestionDto {
  @IsBoolean()
  wasHelpful!: boolean;
}
