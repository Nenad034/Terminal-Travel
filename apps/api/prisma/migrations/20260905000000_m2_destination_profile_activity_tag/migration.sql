-- CreateEnum
CREATE TYPE "DestinationType" AS ENUM ('COASTAL', 'MOUNTAIN', 'URBAN', 'SPA', 'LAKE', 'RURAL');

-- CreateEnum
CREATE TYPE "ActivityTag" AS ENUM ('CYCLING', 'HIKING', 'HUNTING', 'FISHING', 'DIVING', 'SKIING', 'RAFTING', 'WILDLIFE_WATCHING', 'WINE_TASTING');

-- CreateTable
CREATE TABLE "destination_profiles" (
    "id" TEXT NOT NULL,
    "destination_country" TEXT NOT NULL,
    "destination_city" TEXT NOT NULL,
    "destination_type" "DestinationType" NOT NULL,
    "activities" "ActivityTag"[],
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "destination_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "destination_profiles_destination_country_destination_city_key" ON "destination_profiles"("destination_country", "destination_city");
