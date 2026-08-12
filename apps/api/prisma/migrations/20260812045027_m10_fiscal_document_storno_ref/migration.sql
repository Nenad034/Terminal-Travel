-- AlterTable
ALTER TABLE "fiscal_documents" ADD COLUMN     "storno_of_document_id" TEXT,
ALTER COLUMN "vat_calculation_basis" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_storno_of_document_id_fkey" FOREIGN KEY ("storno_of_document_id") REFERENCES "fiscal_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
