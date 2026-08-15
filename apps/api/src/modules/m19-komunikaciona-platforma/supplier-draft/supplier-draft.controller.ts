import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupplierDraftService } from './supplier-draft.service';
import { DraftReplyDto } from './dto/draft-reply.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M19 spec §9.5/§9.7 — POST /chat/supplier-conversations/:id/draft-reply. Pristup se proverava
// preko učešća u razgovoru (SupplierDraftService), ne posebne dozvole — ko sme da vidi/šalje u
// razgovor, sme i da zatraži nacrt za njega.
@ApiTags('chat-supplier-draft')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat/supplier-conversations')
export class SupplierDraftController {
  constructor(private readonly supplierDraft: SupplierDraftService) {}

  @Post(':id/draft-reply')
  draftReply(@Param('id') id: string, @Body() dto: DraftReplyDto, @CurrentUser() user: { userId: string }) {
    return this.supplierDraft.draftReply(id, dto, user.userId);
  }
}
