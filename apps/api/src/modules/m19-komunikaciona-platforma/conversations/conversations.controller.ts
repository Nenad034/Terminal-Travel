import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import type { Response } from 'express';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  ATTACHMENT_UPLOAD_ROOT,
  BLOCKED_ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENT_BYTES,
  ensureConversationUploadDir,
  sanitizeAttachmentFileName,
} from './attachment-storage';

// M19 spec §8 — REST prefiks /chat. Dozvole se ne proveravaju deklarativno preko
// @RequirePermission jer se grananje (DIRECT/GROUP vs EXTERNAL_SUPPLIER, STAFF vs
// SUPPLIER_CONTACT) razlikuje po tipu razgovora/pozivaocu — sprovedeno u ConversationsService
// (isti obrazac kao OmnisearchService/TicketsService koji rade sopstvenu, finiju proveru).
@ApiTags('chat-conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat/conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  findAll(@CurrentUser() user: { userId: string }) {
    return this.conversations.findAllForUser(user.userId);
  }

  @Post()
  create(@Body() dto: CreateConversationDto, @CurrentUser() user: { userId: string }) {
    return this.conversations.create(dto, user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.conversations.findOne(id, user.userId);
  }

  @Get(':id/messages')
  findMessages(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.conversations.findMessages(id, user.userId);
  }

  // §3/§8 — REST fallback za slanje (WS `message.send` je primaran kanal). Prihvata i
  // `multipart/form-data` sa opcionim poljem `file` (§2.5, v1.6, "omogućite u chatovima i
  // porukama da se šalju i preuzimaju fajlovi") — JSON telo bez fajla i dalje radi nepromenjeno
  // (multer ovaj interceptor preskače kad Content-Type nije multipart, isti request prolazi kroz
  // običan Nest body parser kao pre). Fajl se piše DIREKTNO u konačan folder po razgovoru
  // (`ensureConversationUploadDir`), ne u privremeni — jednostavnije za prvi prolaz, bez
  // dodatnog koraka premeštanja.
  @Post(':id/messages')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => cb(null, ensureConversationUploadDir(req.params.id)),
        filename: (_req, file, cb) => cb(null, `${randomUUID()}-${sanitizeAttachmentFileName(file.originalname)}`),
      }),
      limits: { fileSize: MAX_ATTACHMENT_BYTES },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (BLOCKED_ATTACHMENT_EXTENSIONS.includes(ext)) {
          return cb(new BadRequestException(`Tip fajla "${ext}" nije dozvoljen kao prilog.`), false);
        }
        cb(null, true);
      },
    }),
  )
  createMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: { userId: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.conversations.createMessage(id, dto, user.userId, file);
  }

  // §2.5 — preuzimanje priloga, isključivo autentifikovano; pristup proverava servis
  // (`assertParticipant` nad razgovorom kom poruka pripada), ne javna statička putanja.
  @Get('attachments/:attachmentId/download')
  async downloadAttachment(
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: { userId: string },
    @Res() res: Response,
  ) {
    const attachment = await this.conversations.getAttachmentForDownload(attachmentId, user.userId);
    res.download(join(ATTACHMENT_UPLOAD_ROOT, attachment.storagePath), attachment.fileName);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.conversations.markRead(id, user.userId);
  }

  @Patch('messages/:messageId')
  editMessage(@Param('messageId') messageId: string, @Body() dto: UpdateMessageDto, @CurrentUser() user: { userId: string }) {
    return this.conversations.editMessage(messageId, dto, user.userId);
  }

  @Delete('messages/:messageId')
  deleteMessage(@Param('messageId') messageId: string, @CurrentUser() user: { userId: string }) {
    return this.conversations.deleteMessage(messageId, user.userId);
  }
}
