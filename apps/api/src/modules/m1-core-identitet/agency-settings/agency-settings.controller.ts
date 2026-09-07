import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AgencySettingsService } from './agency-settings.service';
import { UpdateAgencySettingsDto } from './dto/update-agency-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M1 spec §3.9c, prefiks /api/v1/iam — identitet agencije kao globalno podešavanje.
@ApiTags('agency-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('iam/agency-settings')
export class AgencySettingsController {
  constructor(private readonly settings: AgencySettingsService) {}

  // Bez @RequirePermission, isti obrazac kao `GET /iam/branches`: naziv i kontakt agencije
  // treba svakom prijavljenom nalogu (zaglavlje panela, potpis u poruci), a dozvola koju bi
  // ionako imali svi nije ograda nego administracija.
  @Get()
  get() {
    return this.settings.get();
  }

  @Put()
  @RequirePermission('M1', 'agency-settings', 'EDIT')
  update(@Body() dto: UpdateAgencySettingsDto, @CurrentUser() actor: { userId: string }) {
    return this.settings.update(dto, actor.userId);
  }
}
