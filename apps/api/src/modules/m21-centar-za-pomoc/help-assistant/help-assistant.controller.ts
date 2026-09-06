import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HelpAudience, HelpConfidence } from '@prisma/client';
import { HelpAssistantService } from './help-assistant.service';
import { AskQuestionDto } from './dto/ask-question.dto';
import { FeedbackQuestionDto } from './dto/feedback-question.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { parsePagination } from '../../../common/pagination/pagination';

// M21 spec §6, prefiks /api/v1/help. ask/feedback/escalate su namerno BEZ @RequirePermission
// (isti obrazac kao M15 OmnisearchController) — vidljivost/publika se rešava unutar
// HelpAssistantService preko resolveHelpAudience, ne kroz statičku dozvolu vezanu za rutu.
// GET /questions JESTE zaštićen (M21/question-log/VIEW, §3) — to je administrativni uvid.
@ApiTags('help-assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('help')
export class HelpAssistantController {
  constructor(private readonly assistant: HelpAssistantService) {}

  @Post('ask')
  ask(@Body() dto: AskQuestionDto, @CurrentUser() actor: { userId: string }) {
    return this.assistant.ask(dto, actor.userId);
  }

  @Post('questions/:id/feedback')
  feedback(@Param('id') id: string, @Body() dto: FeedbackQuestionDto, @CurrentUser() actor: { userId: string }) {
    return this.assistant.feedback(id, dto.wasHelpful, actor.userId);
  }

  @Post('questions/:id/escalate')
  escalate(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.assistant.escalate(id, actor.userId);
  }

  @Get('questions')
  @RequirePermission('M21', 'question-log', 'VIEW')
  // Straničenje (6.9.2026, dok. 39 nalaz 2.2) — odgovor je `{ data, total, ... }`, ne go niz.
  findQuestionLog(
    @Query('audienceContext') audienceContext?: HelpAudience,
    @Query('confidence') confidence?: HelpConfidence,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.assistant.findQuestionLog({ audienceContext, confidence }, parsePagination(page, limit));
  }
}
