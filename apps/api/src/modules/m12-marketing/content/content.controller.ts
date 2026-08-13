import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContentChannel, ContentPieceStatus, ContentPieceType } from '@prisma/client';
import { ContentService } from './content.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { UpsertContentTranslationDto } from './dto/upsert-content-translation.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M12 spec §7, prefiks /api/v1/marketing
@ApiTags('marketing-content')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('marketing/content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  @RequirePermission('M12', 'content', 'VIEW')
  findAll(
    @Query('type') type?: ContentPieceType,
    @Query('status') status?: ContentPieceStatus,
    @Query('channel') channel?: ContentChannel,
    @Query('slug') slug?: string,
  ) {
    return this.content.findAll({ type, status, channel, slug });
  }

  @Post()
  @RequirePermission('M12', 'content', 'CREATE_DRAFT')
  create(@Body() dto: CreateContentDto, @CurrentUser() actor: { userId: string }) {
    return this.content.create(dto, actor.userId);
  }

  @Get(':id')
  @RequirePermission('M12', 'content', 'VIEW')
  findOne(@Param('id') id: string) {
    return this.content.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('M12', 'content', 'CREATE_DRAFT')
  update(@Param('id') id: string, @Body() dto: UpdateContentDto, @CurrentUser() actor: { userId: string }) {
    return this.content.update(id, dto, actor.userId);
  }

  @Post(':id/approve')
  @RequirePermission('M12', 'content', 'APPROVE_PUBLISH')
  approve(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.content.approve(id, actor.userId);
  }

  @Get(':id/translations')
  @RequirePermission('M12', 'content', 'VIEW')
  listTranslations(@Param('id') id: string) {
    return this.content.listTranslations(id);
  }

  @Put(':id/translations')
  @RequirePermission('M12', 'content', 'CREATE_DRAFT')
  upsertTranslation(
    @Param('id') id: string,
    @Body() dto: UpsertContentTranslationDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.content.upsertTranslation(id, dto, actor.userId);
  }
}
