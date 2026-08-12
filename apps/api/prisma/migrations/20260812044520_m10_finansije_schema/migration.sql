-- CreateEnum
CREATE TYPE "ExchangeRateSource" AS ENUM ('NBS_API', 'MANUAL');

-- CreateEnum
CREATE TYPE "FiscalDocumentType" AS ENUM ('SEF_EFAKTURA', 'ESIR_RACUN', 'KNJIZNO_ODOBRENJE');

-- CreateEnum
CREATE TYPE "FiscalDocumentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ISSUED', 'REJECTED', 'STORNIRANO');

-- CreateEnum
CREATE TYPE "VatCalculationBasis" AS ENUM ('MARZA', 'PROVIZIJA', 'PUNA_OSNOVICA');

-- CreateEnum
CREATE TYPE "BuyerAcceptanceStatus" AS ENUM ('N/A', 'PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'CARD');

-- CreateEnum
CREATE TYPE "PaymentRecordStatus" AS ENUM ('PENDING', 'RECEIVED', 'FAILED', 'REFUNDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "PaymentScheduleStatus" AS ENUM ('PENDING', 'MET', 'OVERDUE');

-- CreateEnum
CREATE TYPE "SupplierPaymentMethod" AS ENUM ('BANK_TRANSFER', 'VIRTUAL_CARD');

-- CreateEnum
CREATE TYPE "SupplierObligationStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'DISPUTED');

-- CreateEnum
CREATE TYPE "SupplierPaymentInstructionStatus" AS ENUM ('PENDING', 'EXECUTED', 'FAILED');

-- CreateEnum
CREATE TYPE "GuestRefundMethod" AS ENUM ('BANK_TRANSFER', 'CASH');

-- CreateEnum
CREATE TYPE "RefundInstructionStatus" AS ENUM ('PENDING', 'APPROVED', 'EXECUTED', 'FAILED');

-- CreateEnum
CREATE TYPE "SupplierInvoiceSourceFormat" AS ENUM ('PDF', 'EXCEL', 'WORD', 'HTML', 'EMAIL', 'SCANNED_PDF');

-- CreateEnum
CREATE TYPE "SupplierInvoiceImportStatus" AS ENUM ('PROCESSING', 'READY_FOR_REVIEW', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SupplierInvoiceRowReviewStatus" AS ENUM ('PENDING', 'CONFIRMED', 'MANUALLY_MATCHED', 'REJECTED');

-- CreateTable
CREATE TABLE "exchange_rate_snapshots" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "rate_date" TIMESTAMP(3) NOT NULL,
    "nbs_middle_rate" DECIMAL(65,30) NOT NULL,
    "source" "ExchangeRateSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rate_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_documents" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT,
    "document_type" "FiscalDocumentType" NOT NULL,
    "status" "FiscalDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "vat_calculation_basis" "VatCalculationBasis" NOT NULL,
    "external_reference" TEXT,
    "amount_original" INTEGER NOT NULL,
    "currency_original" TEXT NOT NULL,
    "amount_rsd" INTEGER NOT NULL,
    "vat_rate" DECIMAL(65,30) NOT NULL,
    "vat_amount" INTEGER NOT NULL,
    "exchange_rate_snapshot_id" TEXT,
    "buyer_name_snapshot" TEXT NOT NULL,
    "buyer_tax_id_snapshot" TEXT,
    "buyer_acceptance_status" "BuyerAcceptanceStatus",
    "buyer_acceptance_deadline" TIMESTAMP(3),
    "pdf_url" TEXT,
    "xml_url" TEXT,
    "submitted_by" TEXT,
    "submitted_at" TIMESTAMP(3),
    "issued_at" TIMESTAMP(3),
    "related_subagent_id" TEXT,
    "credited_rebate_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT,
    "quote_id" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentRecordStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "gateway_provider" TEXT,
    "gateway_transaction_id" TEXT,
    "gateway_idempotency_key" TEXT,
    "received_at" TIMESTAMP(3),
    "recorded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_terms_configs" (
    "id" TEXT NOT NULL,
    "deposit_percentage" DECIMAL(65,30) NOT NULL,
    "deposit_due_days_after_confirmation" INTEGER NOT NULL,
    "balance_due_days_before_stay" INTEGER NOT NULL,
    "escalation_days_after_due" INTEGER NOT NULL,
    "updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_terms_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_payment_schedules" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "deposit_amount" INTEGER NOT NULL,
    "deposit_due_date" TIMESTAMP(3) NOT NULL,
    "deposit_status" "PaymentScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "balance_due_date" TIMESTAMP(3) NOT NULL,
    "balance_status" "PaymentScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_payment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_obligations" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "booking_item_id" TEXT,
    "invoice_reference" TEXT,
    "amount_original" INTEGER NOT NULL,
    "currency_original" TEXT NOT NULL,
    "exchange_rate_snapshot_id_at_invoice" TEXT,
    "amount_rsd_at_invoice" INTEGER,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "SupplierObligationStatus" NOT NULL DEFAULT 'PENDING',
    "payment_method" "SupplierPaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "paid_at" TIMESTAMP(3),
    "exchange_rate_snapshot_id_at_payment" TEXT,
    "exchange_rate_difference" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payment_instructions" (
    "id" TEXT NOT NULL,
    "supplier_obligation_id" TEXT NOT NULL,
    "method" "SupplierPaymentMethod" NOT NULL,
    "bank_iban" TEXT,
    "bank_swift" TEXT,
    "virtual_card_reference" TEXT,
    "status" "SupplierPaymentInstructionStatus" NOT NULL DEFAULT 'PENDING',
    "executed_by" TEXT,
    "executed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payment_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_instructions" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "method" "GuestRefundMethod" NOT NULL,
    "status" "RefundInstructionStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" TEXT,
    "executed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executed_at" TIMESTAMP(3),

    CONSTRAINT "refund_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_invoice_imports" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "source_file_url" TEXT NOT NULL,
    "source_format" "SupplierInvoiceSourceFormat" NOT NULL,
    "status" "SupplierInvoiceImportStatus" NOT NULL DEFAULT 'PROCESSING',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_invoice_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_invoice_import_rows" (
    "id" TEXT NOT NULL,
    "supplier_invoice_import_id" TEXT NOT NULL,
    "extracted_guest_name" TEXT NOT NULL,
    "extracted_stay_from" TIMESTAMP(3) NOT NULL,
    "extracted_stay_to" TIMESTAMP(3) NOT NULL,
    "extracted_amount" INTEGER NOT NULL,
    "extracted_currency" TEXT NOT NULL,
    "extracted_invoice_reference" TEXT NOT NULL,
    "matched_supplier_obligation_id" TEXT,
    "match_confidence" DECIMAL(65,30),
    "review_status" "SupplierInvoiceRowReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,

    CONSTRAINT "supplier_invoice_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_gateway_idempotency_key_key" ON "payments"("gateway_idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "client_payment_schedules_booking_id_key" ON "client_payment_schedules"("booking_id");

-- AddForeignKey
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_exchange_rate_snapshot_id_fkey" FOREIGN KEY ("exchange_rate_snapshot_id") REFERENCES "exchange_rate_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_payment_schedules" ADD CONSTRAINT "client_payment_schedules_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_obligations" ADD CONSTRAINT "supplier_obligations_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_obligations" ADD CONSTRAINT "supplier_obligations_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_obligations" ADD CONSTRAINT "supplier_obligations_exchange_rate_snapshot_id_at_invoice_fkey" FOREIGN KEY ("exchange_rate_snapshot_id_at_invoice") REFERENCES "exchange_rate_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_obligations" ADD CONSTRAINT "supplier_obligations_exchange_rate_snapshot_id_at_payment_fkey" FOREIGN KEY ("exchange_rate_snapshot_id_at_payment") REFERENCES "exchange_rate_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment_instructions" ADD CONSTRAINT "supplier_payment_instructions_supplier_obligation_id_fkey" FOREIGN KEY ("supplier_obligation_id") REFERENCES "supplier_obligations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_instructions" ADD CONSTRAINT "refund_instructions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_imports" ADD CONSTRAINT "supplier_invoice_imports_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_import_rows" ADD CONSTRAINT "supplier_invoice_import_rows_supplier_invoice_import_id_fkey" FOREIGN KEY ("supplier_invoice_import_id") REFERENCES "supplier_invoice_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_import_rows" ADD CONSTRAINT "supplier_invoice_import_rows_matched_supplier_obligation_i_fkey" FOREIGN KEY ("matched_supplier_obligation_id") REFERENCES "supplier_obligations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
