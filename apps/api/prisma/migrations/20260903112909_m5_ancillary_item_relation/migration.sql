-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_ancillary_service_id_fkey" FOREIGN KEY ("ancillary_service_id") REFERENCES "ancillary_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
