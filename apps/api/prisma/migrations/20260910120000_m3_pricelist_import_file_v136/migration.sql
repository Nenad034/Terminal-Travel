-- M3 §4.2.7 (v1.36, 10.9.2026) — uvoz cenovnika prima fajl, ne samo nalepljen tekst.
-- Vlasnikova odluka: skladiste je LOKALNI DISK za sada.

-- CreateEnum
CREATE TYPE "PricelistExtractionPath" AS ENUM ('PARSER', 'MODEL');

-- AlterEnum
-- Dve nove vrednosti postojeceg enuma. ALTER TYPE ... ADD VALUE ne moze u transakciji sa
-- ostatkom u starijim Postgres verzijama; od PG12 moze, a docker-compose koristi PG16.
ALTER TYPE "PricelistSourceFormat" ADD VALUE IF NOT EXISTS 'IMAGE';
ALTER TYPE "PricelistSourceFormat" ADD VALUE IF NOT EXISTS 'CSV';

-- AlterTable
ALTER TABLE "pricelist_imports" ADD COLUMN "source_file_name" TEXT;
ALTER TABLE "pricelist_imports" ADD COLUMN "extraction_path" "PricelistExtractionPath";
