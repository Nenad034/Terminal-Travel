import { IsBoolean } from 'class-validator';

export class FeedbackQuestionDto {
  @IsBoolean()
  wasHelpful!: boolean;
}
