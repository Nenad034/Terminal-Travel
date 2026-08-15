import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HelpSuggestionsService } from './help-suggestions.service';
import { ReviewSuggestionDto } from './dto/review-suggestion.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { AgentActionGuard } from '../../../common/guards/agent-action.guard';
import { AgentAction } from '../../../common/decorators/agent-action.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M21 spec §6, prefiks /api/v1/help.
@ApiTags('help-suggestions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, AgentActionGuard)
@Controller('help/suggestions')
export class HelpSuggestionsController {
  constructor(private readonly suggestions: HelpSuggestionsService) {}

  @Get()
  @RequirePermission('M21', 'suggestion', 'APPROVE')
  findPending() {
    return this.suggestions.findPending();
  }

  @Patch(':id')
  @RequirePermission('M21', 'suggestion', 'APPROVE')
  @AgentAction('M21', 'help_article_suggestion.approve')
  review(@Param('id') id: string, @Body() dto: ReviewSuggestionDto, @CurrentUser() actor: { userId: string }) {
    return this.suggestions.review(id, dto.decision, actor.userId);
  }
}
