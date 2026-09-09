-- CreateTable
CREATE TABLE "pricelist_versions" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "snapshot" JSONB NOT NULL,
    "change_count" INTEGER NOT NULL DEFAULT 0,
    "source_import_id" TEXT,
    "instruction_text" TEXT,
    "note" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricelist_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pricelist_versions_contract_id_idx" ON "pricelist_versions"("contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "pricelist_versions_contract_id_version_no_key" ON "pricelist_versions"("contract_id", "version_no");

-- AddForeignKey
ALTER TABLE "pricelist_versions" ADD CONSTRAINT "pricelist_versions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

