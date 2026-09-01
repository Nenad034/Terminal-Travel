-- CreateEnum
CREATE TYPE "PackageDepartureStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateTable
CREATE TABLE "package_departures" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "departure_date" DATE NOT NULL,
    "return_date" DATE NOT NULL,
    "status" "PackageDepartureStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_departures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "package_departures_product_id_idx" ON "package_departures"("product_id");

-- AddForeignKey
ALTER TABLE "package_departures" ADD CONSTRAINT "package_departures_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
