import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GuestDocumentScanService } from './guest-document-scan.service';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// M9 spec §2a / M15 spec §6.5.6e — gost u mobilnoj aplikaciji fotografiše pasoš pri prvom
// kreiranju GuestProfile-a. Samo JwtAuthGuard (bez PermissionsGuard/dozvole) — isti obrazac
// kao PushTokenController: ova radnja ništa ne piše u bazu, samo predlaže polja koja gost sam
// pregleda i potom čuva preko postojećeg M6 POST /crm/guest-profiles. `FileInterceptor` sa
// `memoryStorage` — slika NIKAD ne dodiruje disk, buffer se obrađuje i odmah odbacuje (nikad
// trajno čuvanje, vlasnikova eksplicitna odluka 2.9.2026).
@ApiTags('mobile-guest-profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mobile/guest-profile')
export class GuestDocumentScanController {
  constructor(private readonly scan: GuestDocumentScanService) {}

  @Post('scan-document')
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES } }))
  scanDocument(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() actor: { userId: string }) {
    if (!file) throw new BadRequestException('Nedostaje slika.');
    return this.scan.scan(file, actor.userId);
  }
}
