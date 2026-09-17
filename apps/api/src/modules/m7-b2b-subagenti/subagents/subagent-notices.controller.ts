import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { B2bAudience } from '@prisma/client';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { SubagentNoticesService } from './subagent-notices.service';

class NoticesQueryDto {
  // `@IsBooleanString` + `@Transform` u boolean = uvek 400 (validacija ide POSLE transformacije,
  // pa vidi `false`, ne `'false'`) — zamka 8.17. Zato `@IsBoolean` nad već pretvorenom vrednošću.
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : value === 'true' || value === true))
  unread?: boolean;

  /** Samo za osoblje — subagent uvek vidi sopstveni spisak. */
  @IsUUID()
  @IsOptional()
  subagentId?: string;
}

class NoticeRecipientsQueryDto {
  @IsUUID()
  productId!: string;

  @IsEnum(B2bAudience)
  audience!: B2bAudience;
}

/**
 * M7 spec §11 (v1.13) — `/b2b/notices*`. Ista široka dozvola (`M7/subagent/VIEW`, koju ima i
 * `SUBAGENT_ADMIN`) i sužavanje na „sopstveno" u servisu, kao ostatak M7 kontrolera.
 */
@ApiTags('b2b-subagents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('b2b')
export class SubagentNoticesController {
  constructor(private readonly notices: SubagentNoticesService) {}

  @Get('notices')
  @RequirePermission('M7', 'subagent', 'VIEW')
  list(@CurrentUser() actor: { userId: string }, @Query() q: NoticesQueryDto) {
    return this.notices.listForCaller(actor.userId, q);
  }

  @Post('notices/:contentId/read')
  @RequirePermission('M7', 'subagent', 'VIEW')
  markRead(
    @CurrentUser() actor: { userId: string },
    @Param('contentId') contentId: string,
    @Query('subagentId') subagentId?: string,
  ) {
    return this.notices.markRead(actor.userId, contentId, subagentId || undefined);
  }

  /** Interni — zove ga M12 `B2B_SUBAGENTS` adapter (§5b.1); izložen i preko HTTP-a radi provere. */
  @Get('notice-recipients')
  @RequirePermission('M7', 'subagent', 'VIEW')
  recipients(@Query() q: NoticeRecipientsQueryDto) {
    return this.notices.findRecipients(q.productId, q.audience);
  }
}
