import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateSupplierContactDto } from './dto/create-supplier-contact.dto';
import { UpdateSupplierContactDto } from './dto/update-supplier-contact.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M3 spec §6, prefiks /api/v1/contracting
@ApiTags('contracting-suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('contracting/suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @RequirePermission('M3', 'supplier', 'VIEW')
  findAll() {
    return this.suppliers.findAll();
  }

  @Post()
  @RequirePermission('M3', 'supplier', 'CREATE')
  create(@Body() dto: CreateSupplierDto, @CurrentUser() actor: { userId: string }) {
    return this.suppliers.create(dto, actor.userId);
  }

  @Get(':id')
  @RequirePermission('M3', 'supplier', 'VIEW')
  findOne(@Param('id') id: string) {
    return this.suppliers.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('M3', 'supplier', 'EDIT')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto, @CurrentUser() actor: { userId: string }) {
    return this.suppliers.update(id, dto, actor.userId);
  }

  @Get(':id/contacts')
  @RequirePermission('M3', 'supplier-contact', 'VIEW')
  listContacts(@Param('id') id: string) {
    return this.suppliers.listContacts(id);
  }

  @Post(':id/contacts')
  @RequirePermission('M3', 'supplier-contact', 'CREATE')
  createContact(
    @Param('id') id: string,
    @Body() dto: CreateSupplierContactDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.suppliers.createContact(id, dto, actor.userId);
  }

  @Get(':id/contacts/:contactId')
  @RequirePermission('M3', 'supplier-contact', 'VIEW')
  findContact(@Param('contactId') contactId: string) {
    return this.suppliers.findContact(contactId);
  }

  @Patch(':id/contacts/:contactId')
  @RequirePermission('M3', 'supplier-contact', 'EDIT')
  updateContact(
    @Param('contactId') contactId: string,
    @Body() dto: UpdateSupplierContactDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.suppliers.updateContact(contactId, dto, actor.userId);
  }
}
