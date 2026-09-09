-- AlterTable
ALTER TABLE "contract_periods" ADD COLUMN     "allowed_stay_nights" INTEGER[],
ADD COLUMN     "arrival_weekdays" INTEGER[],
ADD COLUMN     "departure_weekdays" INTEGER[];

-- AlterTable
ALTER TABLE "rate_lines" ADD COLUMN     "valid_weekdays" INTEGER[];
