import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, ProductType } from '@prisma/client';

/**
 * M5 §6.7b / §3.0j.3 — proizvod za ručnu stavku: `DRAFT` (ili `ACTIVE` uz „sačuvaj u katalog"),
 * `source_type = MANUAL`, obavezan dobavljač, bez kanala dok je DRAFT — nevidljiv pretrazi,
 * sajtu i portalu. Jedan kod za rezervaciju (§6.7b) i ponudu (§3.0j): druga kopija istog upisa
 * bi se pre ili kasnije razišla u tome šta znači „u katalogu".
 */
export interface ManualProductInput {
  productType: ProductType;
  name: string;
  description?: string | null;
  supplierId: string;
  destinationCountry: string;
  destinationCity: string;
  saveToCatalog?: boolean;
  /** §3.0j.7 tačka 3 — predlog sa zvaničnog sajta koji je čovek odobrio (`attributes`). */
  attributes?: Record<string, unknown> | null;
  createdBy: string | null;
}

export function manualProductSlug(name: string): string {
  return `${
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'usluga'
  }-${Date.now().toString(36)}`;
}

/** Zaštita od zamenjenih polja, ne zabrana prodaje ispod nabavne (§6.7b). */
export function assertPricesNotSwapped(baseCost: number | null, finalPrice: number | null): void {
  if (baseCost !== null && finalPrice !== null && finalPrice < baseCost) {
    throw new BadRequestException(
      'Izlazna cena ne sme biti manja od nabavne — proverite da polja nisu zamenjena (M5 spec §6.7b).',
    );
  }
}

export async function createManualProduct(tx: Prisma.TransactionClient, input: ManualProductInput) {
  const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId } });
  if (!supplier) throw new NotFoundException(`Dobavljač ${input.supplierId} nije pronađen.`);
  return tx.product.create({
    data: {
      type: input.productType,
      sourceType: 'MANUAL',
      supplierId: supplier.id,
      destinationCountry: input.destinationCountry,
      destinationCity: input.destinationCity,
      status: input.saveToCatalog ? 'ACTIVE' : 'DRAFT',
      visibleChannels: input.saveToCatalog ? ['B2C_SITE', 'B2B_PORTAL'] : [],
      attributes: (input.attributes ?? {}) as Prisma.InputJsonValue,
      createdBy: input.createdBy,
      translations: {
        // `description`/`slug` su obavezni u M2 modelu; bez opisa ide prazan string, ne izmišljen
        // tekst. Slug nosi vreme unosa da dva istoimena unosa ne bi delila slug.
        create: [
          {
            languageCode: 'sr' as const,
            name: input.name,
            description: input.description ?? '',
            slug: manualProductSlug(input.name),
          },
        ],
      },
    },
  });
}
