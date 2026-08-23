import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { join } from 'path';
import type { Response } from 'express';
import { ContentChannel, ContentPieceStatus, ContentPieceType } from '@prisma/client';
import { ContentService } from './content.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { UpsertContentTranslationDto } from './dto/upsert-content-translation.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AgentActionGuard } from '../../../common/guards/agent-action.guard';
import { AgentAction } from '../../../common/decorators/agent-action.decorator';
import {
  CONTENT_MEDIA_UPLOAD_ROOT,
  MAX_CONTENT_MEDIA_BYTES,
  ensureContentMediaUploadDir,
  isAllowedContentMediaMimeType,
  sanitizeContentMediaFileName,
} from './content-media-storage';

// M12 spec §7, prefiks /api/v1/marketing
@ApiTags('marketing-content')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, AgentActionGuard)
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
  @AgentAction('M12', 'content.approve_publish')
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

  // §2.5 (23.8.2026) — slika/video prilog. Isti obrazac kao M19 `ConversationsController`
  // (`multipart/form-data`, `diskStorage` piše direktno u konačan folder po `ContentPiece`).
  // Dozvola ista kao izmena teksta sadržaja (`CREATE_DRAFT`) — dodavanje medije je uređivačka
  // radnja istog ranga kao izmena naslova/tela, ne poseban nivo prava.
  @Post(':id/media')
  @RequirePermission('M12', 'content', 'CREATE_DRAFT')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => cb(null, ensureContentMediaUploadDir(req.params.id)),
        filename: (_req, file, cb) => cb(null, `${randomUUID()}-${sanitizeContentMediaFileName(file.originalname)}`),
      }),
      limits: { fileSize: MAX_CONTENT_MEDIA_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!isAllowedContentMediaMimeType(file.mimetype)) {
          return cb(new BadRequestException(`Tip fajla "${file.mimetype}" nije dozvoljen — samo slika/video.`), false);
        }
        cb(null, true);
      },
    }),
  )
  addMedia(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() actor: { userId: string }) {
    return this.content.addMedia(id, file, actor.userId);
  }

  @Get('media/:mediaId/download')
  @RequirePermission('M12', 'content', 'VIEW')
  async downloadMedia(@Param('mediaId') mediaId: string, @Res() res: Response) {
    const media = await this.content.getMediaForDownload(mediaId);
    res.download(join(CONTENT_MEDIA_UPLOAD_ROOT, media.storagePath), media.fileName);
  }

  @Delete('media/:mediaId')
  @RequirePermission('M12', 'content', 'CREATE_DRAFT')
  removeMedia(@Param('mediaId') mediaId: string, @CurrentUser() actor: { userId: string }) {
    return this.content.removeMedia(mediaId, actor.userId);
  }
}
