-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('ORGANIZOVANO_PUTOVANJE', 'POSREDOVANJE', 'PRODAJA_AVIO_KARTE', 'TRANSFER', 'KORPORATIVNI_OKVIRNI');

-- CreateEnum
CREATE TYPE "ClientContractStatus" AS ENUM ('DRAFT', 'GENERATED', 'ACCEPTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ClientContractAcceptedMethod" AS ENUM ('ELECTRONIC_CLICKWRAP', 'WET_SIGNATURE_SCAN');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "contract_terms_accepted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "client_contracts" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "contract_type" "ContractType" NOT NULL,
    "status" "ClientContractStatus" NOT NULL DEFAULT 'DRAFT',
    "document_url" TEXT,
    "generated_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "accepted_method" "ClientContractAcceptedMethod",
    "voided_by" TEXT,
    "supersedes_contract_id" TEXT,
    "content_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_contracts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "client_contracts" ADD CONSTRAINT "client_contracts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contracts" ADD CONSTRAINT "client_contracts_supersedes_contract_id_fkey" FOREIGN KEY ("supersedes_contract_id") REFERENCES "client_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
