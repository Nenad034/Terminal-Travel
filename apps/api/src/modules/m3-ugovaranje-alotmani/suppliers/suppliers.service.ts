import { Injectable } from '@nestjs/common';
import { Prisma, SupplierType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateSupplierContactDto } from './dto/create-supplier-contact.dto';
import { UpdateSupplierContactDto } from './dto/update-supplier-contact.dto';
import {
  type PaginationQueryDto,
  paginated,
  paginationArgs,
} from '../../../common/pagination/pagination';
import { supplierProductScope, type ProductScopeFilters } from '../product-scope';

export interface SupplierFilters extends ProductScopeFilters {
  /** Naziv dobavljača — sadrži, bez obzira na velika slova. */
  q?: string;
  type?: SupplierType;
  /** Država SEDIŠTA dobavljača, ne destinacija — za destinaciju vidi `product-scope.ts`. */
  country?: string;
}

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // Razvrstavanje 8.9.2026 (dok. 27, nastavak nalaza 2.2) — raste sa svakim novim dobavljačem.
  // OVA lista se, za razliku od većine ostalih ispravljenih ovim prolazom, koristi na dva
  // suštinski različita načina: (a) `/dobavljaci` je stvaran browse ekran (dobija straničenje
  // + `Pagination`), (b) šest drugih mesta je koristi kao IZVOR ZA PADAJUĆU LISTU (forma za nov
  // ugovor, filter liste rezervacija, chat "novi razgovor", API posrednik za autocomplete) —
  // ta mesta traže `?limit=200` (tvrd plafon, ne "sve bez granice") jer bi dobavljač nevidljiv
  // u padajućoj listi bio gori kvar (ne može se izabrati) od browse ekrana bez kraja liste.
  /**
   * Filteri (9.9.2026, vlasnikov zahtev — ekran /dobavljaci do sad nije imao NIJEDAN, ni
   * pretragu po imenu). Filtriranje ide na SERVER, ne nad dovučenom stranom: lista je
   * straničena, pa bi klijentski filter pretraživao samo trenutnih N redova i tiho krio ostalo
   * (ista greška je već jednom ispravljena na drugim listama, dok. 27 nalaz 2.2).
   *
   * Destinacija/objekat/vrsta gađaju PROIZVODE tog dobavljača — vidi `product-scope.ts` za
   * obrazloženje zašto `Supplier.country` (sedište firme) nije odgovor na pitanje „Grčka".
   */
  async findAll(pagination?: PaginationQueryDto, filters?: SupplierFilters) {
    const { skip, take, page, limit } = paginationArgs(pagination);
    const q = filters?.q?.trim();
    const where: Prisma.SupplierWhereInput = {
      type: filters?.type,
      country: filters?.country ? { contains: filters.country, mode: 'insensitive' } : undefined,
      name: q ? { contains: q, mode: 'insensitive' } : undefined,
      ...supplierProductScope(filters),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
      this.prisma.supplier.count({ where }),
    ]);
    return paginated(data, total, page, limit);
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
    return this.prisma.supplierContact.findMany({
      where: { supplierId },
      orderBy: { createdAt: 'desc' },
    });
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
    const before = await this.prisma.supplierContact.findUniqueOrThrow({
      where: { id: contactId },
    });
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
