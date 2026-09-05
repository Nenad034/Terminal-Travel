-- Indeksi na stranim ključevima (5.9.2026, dok. 39 nalaz 2.1).
--
-- Postgres NE pravi indeks na koloni koja pokazuje na drugu tabelu — pravi ga samo na strani
-- na koju se pokazuje (primarni ključ). Bez ovih indeksa svaki JOIN po stranom ključu i svaka
-- provera pri brisanju roditelja čitaju CELU tabelu. Na 16 mock rezervacija se ne primeti;
-- na stvarnom prometu je razlika između trenutnog i minutnog odgovora.
--
-- Izmereno pre: 81 od 102 stranih ključeva bez indeksa (uključujući proveru da nisu pokriveni
-- kao vodeći stubac nekog složenog indeksa). Ova migracija pokriva svih 81.
--
-- NAMERNO IZOSTAVLJENO iz automatski generisanog diff-a: `DROP TABLE destination_profiles`
-- i dva prateća `DROP TYPE`. Ta tabela postoji u bazi a ne u ovoj šemi (prazna je) — ostatak
-- rada sa druge grane koja deli istu razvojnu bazu. Brisanje tuđeg posla nije deo ovog nalaza.

-- CreateIndex
CREATE INDEX "agent_invocation_logs_agent_id_idx" ON "agent_invocation_logs"("agent_id");

-- CreateIndex
CREATE INDEX "ancillary_services_contract_period_id_idx" ON "ancillary_services"("contract_period_id");

-- CreateIndex
CREATE INDEX "article_revisions_article_id_idx" ON "article_revisions"("article_id");

-- CreateIndex
CREATE INDEX "article_sources_article_id_idx" ON "article_sources"("article_id");

-- CreateIndex
CREATE INDEX "booking_handoff_requests_booking_id_idx" ON "booking_handoff_requests"("booking_id");

-- CreateIndex
CREATE INDEX "booking_items_booking_id_idx" ON "booking_items"("booking_id");

-- CreateIndex
CREATE INDEX "booking_items_markup_rule_id_idx" ON "booking_items"("markup_rule_id");

-- CreateIndex
CREATE INDEX "booking_items_ancillary_service_id_idx" ON "booking_items"("ancillary_service_id");

-- CreateIndex
CREATE INDEX "booking_items_parent_item_id_idx" ON "booking_items"("parent_item_id");

-- CreateIndex
CREATE INDEX "booking_items_rate_line_id_idx" ON "booking_items"("rate_line_id");

-- CreateIndex
CREATE INDEX "booking_items_product_id_idx" ON "booking_items"("product_id");

-- CreateIndex
CREATE INDEX "cancellation_rules_contract_period_id_idx" ON "cancellation_rules"("contract_period_id");

-- CreateIndex
CREATE INDEX "client_contracts_booking_id_idx" ON "client_contracts"("booking_id");

-- CreateIndex
CREATE INDEX "client_contracts_supersedes_contract_id_idx" ON "client_contracts"("supersedes_contract_id");

-- CreateIndex
CREATE INDEX "client_loyalty_statuses_current_tier_id_idx" ON "client_loyalty_statuses"("current_tier_id");

-- CreateIndex
CREATE INDEX "client_loyalty_statuses_manual_override_tier_id_idx" ON "client_loyalty_statuses"("manual_override_tier_id");

-- CreateIndex
CREATE INDEX "commission_rebates_triggering_tier_id_idx" ON "commission_rebates"("triggering_tier_id");

-- CreateIndex
CREATE INDEX "commission_rebates_subagent_id_idx" ON "commission_rebates"("subagent_id");

-- CreateIndex
CREATE INDEX "commission_volume_tiers_subagent_id_idx" ON "commission_volume_tiers"("subagent_id");

-- CreateIndex
CREATE INDEX "content_media_content_piece_id_idx" ON "content_media"("content_piece_id");

-- CreateIndex
CREATE INDEX "contract_periods_contract_id_idx" ON "contract_periods"("contract_id");

-- CreateIndex
CREATE INDEX "contracts_supplier_id_idx" ON "contracts"("supplier_id");

-- CreateIndex
CREATE INDEX "email_messages_thread_id_idx" ON "email_messages"("thread_id");

-- CreateIndex
CREATE INDEX "email_threads_mailbox_id_idx" ON "email_threads"("mailbox_id");

-- CreateIndex
CREATE INDEX "fiscal_documents_storno_of_document_id_idx" ON "fiscal_documents"("storno_of_document_id");

-- CreateIndex
CREATE INDEX "fiscal_documents_booking_id_idx" ON "fiscal_documents"("booking_id");

-- CreateIndex
CREATE INDEX "fiscal_documents_exchange_rate_snapshot_id_idx" ON "fiscal_documents"("exchange_rate_snapshot_id");

-- CreateIndex
CREATE INDEX "guest_profiles_linked_client_account_id_idx" ON "guest_profiles"("linked_client_account_id");

-- CreateIndex
CREATE INDEX "itinerary_segments_itinerary_id_idx" ON "itinerary_segments"("itinerary_id");

-- CreateIndex
CREATE INDEX "itinerary_segments_product_id_idx" ON "itinerary_segments"("product_id");

-- CreateIndex
CREATE INDEX "message_attachments_message_id_idx" ON "message_attachments"("message_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE INDEX "mfa_recovery_codes_user_id_idx" ON "mfa_recovery_codes"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "payment_check_details_payment_id_idx" ON "payment_check_details"("payment_id");

-- CreateIndex
CREATE INDEX "payment_check_details_bank_id_idx" ON "payment_check_details"("bank_id");

-- CreateIndex
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");

-- CreateIndex
CREATE INDEX "payments_quote_id_idx" ON "payments"("quote_id");

-- CreateIndex
CREATE INDEX "payments_bank_id_idx" ON "payments"("bank_id");

-- CreateIndex
CREATE INDEX "pricelist_import_rows_pricelist_import_id_idx" ON "pricelist_import_rows"("pricelist_import_id");

-- CreateIndex
CREATE INDEX "pricelist_import_rows_matched_product_id_idx" ON "pricelist_import_rows"("matched_product_id");

-- CreateIndex
CREATE INDEX "pricelist_imports_supplier_id_idx" ON "pricelist_imports"("supplier_id");

-- CreateIndex
CREATE INDEX "pricelist_offers_contract_period_id_idx" ON "pricelist_offers"("contract_period_id");

-- CreateIndex
CREATE INDEX "product_content_import_fields_import_id_idx" ON "product_content_import_fields"("import_id");

-- CreateIndex
CREATE INDEX "product_content_imports_product_id_idx" ON "product_content_imports"("product_id");

-- CreateIndex
CREATE INDEX "products_supplier_id_idx" ON "products"("supplier_id");

-- CreateIndex
CREATE INDEX "products_source_contract_id_idx" ON "products"("source_contract_id");

-- CreateIndex
CREATE INDEX "provider_call_logs_provider_code_idx" ON "provider_call_logs"("provider_code");

-- CreateIndex
CREATE INDEX "quote_items_markup_rule_id_idx" ON "quote_items"("markup_rule_id");

-- CreateIndex
CREATE INDEX "quote_items_quote_id_idx" ON "quote_items"("quote_id");

-- CreateIndex
CREATE INDEX "quote_items_product_id_idx" ON "quote_items"("product_id");

-- CreateIndex
CREATE INDEX "quote_items_rate_line_id_idx" ON "quote_items"("rate_line_id");

-- CreateIndex
CREATE INDEX "quotes_itinerary_id_idx" ON "quotes"("itinerary_id");

-- CreateIndex
CREATE INDEX "rate_line_age_pricing_rate_line_id_idx" ON "rate_line_age_pricing"("rate_line_id");

-- CreateIndex
CREATE INDEX "rate_lines_contract_period_id_idx" ON "rate_lines"("contract_period_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refund_instructions_payment_id_idx" ON "refund_instructions"("payment_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "subagent_volume_statuses_current_tier_id_idx" ON "subagent_volume_statuses"("current_tier_id");

-- CreateIndex
CREATE INDEX "subagents_parent_subagent_id_idx" ON "subagents"("parent_subagent_id");

-- CreateIndex
CREATE INDEX "supplier_announcement_rules_supplier_id_idx" ON "supplier_announcement_rules"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_change_notices_booking_item_id_idx" ON "supplier_change_notices"("booking_item_id");

-- CreateIndex
CREATE INDEX "supplier_contacts_supplier_id_idx" ON "supplier_contacts"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_invoice_import_rows_supplier_invoice_import_id_idx" ON "supplier_invoice_import_rows"("supplier_invoice_import_id");

-- CreateIndex
CREATE INDEX "supplier_invoice_import_rows_matched_supplier_obligation_id_idx" ON "supplier_invoice_import_rows"("matched_supplier_obligation_id");

-- CreateIndex
CREATE INDEX "supplier_invoice_imports_supplier_id_idx" ON "supplier_invoice_imports"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_manifest_items_booking_item_id_idx" ON "supplier_manifest_items"("booking_item_id");

-- CreateIndex
CREATE INDEX "supplier_manifests_contract_period_id_idx" ON "supplier_manifests"("contract_period_id");

-- CreateIndex
CREATE INDEX "supplier_manifests_supplier_id_idx" ON "supplier_manifests"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_manifests_supersedes_manifest_id_idx" ON "supplier_manifests"("supersedes_manifest_id");

-- CreateIndex
CREATE INDEX "supplier_obligations_supplier_id_idx" ON "supplier_obligations"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_obligations_exchange_rate_snapshot_id_at_payment_idx" ON "supplier_obligations"("exchange_rate_snapshot_id_at_payment");

-- CreateIndex
CREATE INDEX "supplier_obligations_exchange_rate_snapshot_id_at_invoice_idx" ON "supplier_obligations"("exchange_rate_snapshot_id_at_invoice");

-- CreateIndex
CREATE INDEX "supplier_obligations_booking_item_id_idx" ON "supplier_obligations"("booking_item_id");

-- CreateIndex
CREATE INDEX "supplier_payment_instructions_supplier_obligation_id_idx" ON "supplier_payment_instructions"("supplier_obligation_id");

-- CreateIndex
CREATE INDEX "ticket_messages_ticket_id_idx" ON "ticket_messages"("ticket_id");

-- CreateIndex
CREATE INDEX "travel_guarantee_registrations_travel_guarantee_id_idx" ON "travel_guarantee_registrations"("travel_guarantee_id");

-- CreateIndex
CREATE INDEX "user_permission_overrides_granted_by_idx" ON "user_permission_overrides"("granted_by");

-- CreateIndex
CREATE INDEX "user_permission_overrides_permission_id_idx" ON "user_permission_overrides"("permission_id");

-- CreateIndex
CREATE INDEX "user_permission_overrides_user_id_idx" ON "user_permission_overrides"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");
