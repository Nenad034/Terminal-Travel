-- DropForeignKey
ALTER TABLE "client_loyalty_statuses" DROP CONSTRAINT "client_loyalty_statuses_client_account_id_fkey";

-- DropForeignKey
ALTER TABLE "communication_logs" DROP CONSTRAINT "communication_logs_client_account_id_fkey";

-- DropForeignKey
ALTER TABLE "communication_logs" DROP CONSTRAINT "communication_logs_guest_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "post_trip_surveys" DROP CONSTRAINT "post_trip_surveys_client_account_id_fkey";
