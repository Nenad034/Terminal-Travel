import { IsIn } from 'class-validator';

// M21 spec §6 — PATCH /help/suggestions/:id. `decision=APPROVE` kreira HelpArticle
// (status=PENDING_APPROVAL, i dalje čeka sopstveni korak objavljivanja); `REJECT` samo menja status.
export class ReviewSuggestionDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';
}
