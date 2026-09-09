import { IsNumber, IsObject, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

// M2 spec §7 — PATCH /products/:id. Cena nikad nije polje ovde (§4) — namerno izostavljena.
export class UpdateProductDto {
  /**
   * §5.2 (v1.26) — veza ka M3 ugovoru iz kog proizvod uzima cene. Do ove dopune polje nije
   * postojalo u telu, pa se u panelu proizvod NIJE mogao vezati za ugovor ni na jedan način —
   * a bez te veze pretraga ne nalazi nijednu cenu i proizvod nikad ne uđe u rezultat.
   *
   * `null` raskida vezu (proizvod se vraća u stanje „nema izvor cene"); izostavljeno polje je
   * ne dira. Servis proverava da ugovor postoji i da je proizvod `CONTRACTED`.
   */
  @IsUUID()
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  sourceContractId?: string | null;

  @IsString()
  @IsOptional()
  destinationCountry?: string;

  @IsString()
  @IsOptional()
  destinationCity?: string;

  // M2 spec §2.1b (4.9.2026) — opciono, regija/poluostrvo/grupa ostrva KAD se razlikuje od
  // destinationCity (npr. "Sitonija, Halkidiki" za mesto koje je unutar Halkidikija).
  @IsString()
  @IsOptional()
  destinationArea?: string;

  @IsNumber()
  @IsOptional()
  geoLat?: number;

  @IsNumber()
  @IsOptional()
  geoLng?: number;

  // §2.3a — niz strukturiranih stavki galerije; validacija oblika je na nivou servisa/testova
  // (JSONB je namerno fleksibilan, spec §2.3 kaže "nije prinudno na nivou baze").
  @IsObject({ each: true })
  @IsOptional()
  media?: Record<string, unknown>[];

  // §2.3 — konvencija po tipu proizvoda (room_types[], amenities[]...), fleksibilan JSONB.
  @IsObject()
  @IsOptional()
  attributes?: Record<string, unknown>;
}
