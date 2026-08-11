import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateSupplierContactDto } from './dto/create-supplier-contact.dto';
import { UpdateSupplierContactDto } from './dto/update-supplier-contact.dto';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll() {
    return this.prisma.supplier.findMany({ orderBy: { name: 'asc' } });
  }

  findOne(id: string) {
    return this.prisma.supplier.findUniqueOrThrow({ where: { id } });
  }

  async create(dto: CreateSupplierDto, actorId: string) {
    const supplier = await this.prisma.supplier.create({ data: { ...dto, status: 'ACTIVE' } });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'supplier.created',
      resourceType: 'Supplier',
      resourceId: supplier.id,
      afterState: supplier,
      context: {},
    });
    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto, actorId: string) {
    const before = await this.prisma.supplier.findUniqueOrThrow({ where: { id } });
    const after = await this.prisma.supplier.update({ where: { id }, data: dto });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'supplier.updated',
      resourceType: 'Supplier',
      resourceId: id,
      beforeState: before,
      afterState: after,
      context: {},
    });
    return after;
  }

  // §2.1a
  listContacts(supplierId: string) {
    return this.prisma.supplierContact.findMany({ where: { supplierId }, orderBy: { createdAt: 'desc' } });
  }

  async createContact(supplierId: string, dto: CreateSupplierContactDto, actorId: string) {
    const contact = await this.prisma.supplierContact.create({
      data: { supplierId, ...dto, status: 'ACTIVE' },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'supplier_contact.created',
      resourceType: 'SupplierContact',
      resourceId: contact.id,
      afterState: contact,
      context: { supplierId },
    });
    return contact;
  }

  findContact(contactId: string) {
    return this.prisma.supplierContact.findUniqueOrThrow({ where: { id: contactId } });
  }

  // §6 — linked_user_id se namerno ne prima kroz ovaj DTO (samo preko M19 toka).
  async updateContact(contactId: string, dto: UpdateSupplierContactDto, actorId: string) {
    const before = await this.prisma.supplierContact.findUniqueOrThrow({ where: { id: contactId } });
    const after = await this.prisma.supplierContact.update({ where: { id: contactId }, data: dto });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'supplier_contact.updated',
      resourceType: 'SupplierContact',
      resourceId: contactId,
      beforeState: before,
      afterState: after,
      context: {},
    });
    return after;
  }
}
