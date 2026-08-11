import { Module } from '@nestjs/common';
import { ProductsModule } from './products/products.module';
import { ProductContentImportsModule } from './product-content-imports/product-content-imports.module';

// docs/moduli/M02-katalog-proizvoda/03-SPECIFIKACIJA-M2-KATALOG-PROIZVODA.md
@Module({
  imports: [ProductsModule, ProductContentImportsModule],
})
export class M2KatalogProizvodaModule {}
