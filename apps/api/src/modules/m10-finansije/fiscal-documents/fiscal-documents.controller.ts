import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FiscalDocumentsService } from './fiscal-documents.service';
import { CreateFiscalDocumentDraftDto } from './dto/create-draft.dto';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M10 spec §10, prefiks /api/v1/finance
@ApiTags('finance-fiscal-documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/fiscal-documents')
export class FiscalDocumentsController {
  constructor(private readonly fiscalDocuments: FiscalDocumentsService) {}

  @Post('draft')
  @RequirePermission('M10', 'fiscal-document', 'CREATE_DRAFT')
  createDraft(@Body() dto: CreateFiscalDocumentDraftDto) {
    return this.fiscalDocuments.prepareDraft(dto.bookingId);
  }

  @Post('credit-note/draft')
  @RequirePermission('M10', 'fiscal-document', 'CREATE_DRAFT')
  createCreditNoteDraft(@Body() dto: CreateCreditNoteDto) {
    return this.fiscalDocuments.prepareCreditNoteDraft(dto);
  }

  @Get(':id')
  @RequirePermission('M10', 'fiscal-document', 'VIEW')
  findOne(@Param('id') id: string) {
    return this.fiscalDocuments.findOne(id);
  }

  @Post(':id/submit')
  @RequirePermission('M10', 'fiscal-document', 'SUBMIT')
  submit(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.fiscalDocuments.submit(id, actor);
  }

  @Post(':id/storno')
  @RequirePermission('M10', 'fiscal-document', 'SUBMIT')
  storno(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.fiscalDocuments.storno(id, actor);
  }
}
