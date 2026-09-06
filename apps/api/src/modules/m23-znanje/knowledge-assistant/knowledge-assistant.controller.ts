import { Body, Controller, Param, Post, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArticleConfidence } from '@prisma/client';
import { KnowledgeAssistantService } from './knowledge-assistant.service';
import { AskQuestionDto } from './dto/ask-question.dto';
import { FeedbackQuestionDto } from './dto/feedback-question.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { parsePagination } from '../../../common/pagination/pagination';

// M23 spec §8 — POST /ask, POST /questions/:id/feedback, POST /questions/:id/request-research.
// GET /questions je M23/question-log/VIEW (§6 — Vlasnik/Direktor, uvid radi kvaliteta sadržaja).
@ApiTags('knowledge-assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('knowledge')
export class KnowledgeAssistantController {
  constructor(private readonly assistant: KnowledgeAssistantService) {}

  @Post('ask')
  @RequirePermission('M23', 'article', 'VIEW')
  ask(@Body() dto: AskQuestionDto, @CurrentUser() actor: { userId: string }) {
    return this.assistant.ask(dto, actor.userId);
  }

  @Post('questions/:id/feedback')
  feedback(@Param('id') id: string, @Body() dto: FeedbackQuestionDto, @CurrentUser() actor: { userId: string }) {
    return this.assistant.feedback(id, dto.wasHelpful, actor.userId);
  }

  @Post('questions/:id/request-research')
  requestResearch(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.assistant.requestResearch(id, actor.userId);
  }

  @Get('questions')
  @RequirePermission('M23', 'question-log', 'VIEW')
  // Straničenje (6.9.2026, dok. 39 nalaz 2.2) — odgovor je `{ data, total, ... }`, ne go niz.
  findQuestionLog(
    @Query('confidence') confidence?: ArticleConfidence,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.assistant.findQuestionLog({ confidence }, parsePagination(page, limit));
  }
}
