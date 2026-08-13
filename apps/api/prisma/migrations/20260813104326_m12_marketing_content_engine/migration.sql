-- CreateEnum
CREATE TYPE "ContentPieceType" AS ENUM ('BLOG_POST', 'SOCIAL_POST', 'EMAIL_NEWSLETTER', 'BANNER', 'STATIC_PAGE');

-- CreateEnum
CREATE TYPE "ContentChannel" AS ENUM ('M8_SITE', 'FACEBOOK', 'INSTAGRAM', 'EMAIL', 'MOBILE_PUSH');

-- CreateEnum
CREATE TYPE "ContentPieceStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ContentGeneratedBy" AS ENUM ('AI', 'HUMAN');

-- CreateEnum
CREATE TYPE "ChannelConfigStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "content_pieces" (
    "id" TEXT NOT NULL,
    "product_id" TEXT,
    "type" "ContentPieceType" NOT NULL,
    "slug" TEXT,
    "tracking_code" TEXT NOT NULL,
    "target_channels" "ContentChannel"[],
    "target_tags" JSONB,
    "contains_ai_generated_media" BOOLEAN NOT NULL DEFAULT false,
    "scheduled_publish_at" TIMESTAMP(3),
    "status" "ContentPieceStatus" NOT NULL DEFAULT 'DRAFT',
    "generated_by" "ContentGeneratedBy" NOT NULL,
    "approved_by" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_pieces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_translations" (
    "id" TEXT NOT NULL,
    "content_piece_id" TEXT NOT NULL,
    "language_code" "LanguageCode" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "translation_source" "TranslationSource" NOT NULL DEFAULT 'MANUAL',
    "is_reviewed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_configs" (
    "id" TEXT NOT NULL,
    "channel_code" "ContentChannel" NOT NULL,
    "display_name" TEXT NOT NULL,
    "auth_config_encrypted" TEXT,
    "status" "ChannelConfigStatus" NOT NULL DEFAULT 'INACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_pieces_slug_key" ON "content_pieces"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "content_pieces_tracking_code_key" ON "content_pieces"("tracking_code");

-- CreateIndex
CREATE UNIQUE INDEX "content_translations_content_piece_id_language_code_key" ON "content_translations"("content_piece_id", "language_code");

-- CreateIndex
CREATE UNIQUE INDEX "channel_configs_channel_code_key" ON "channel_configs"("channel_code");

-- AddForeignKey
ALTER TABLE "content_translations" ADD CONSTRAINT "content_translations_content_piece_id_fkey" FOREIGN KEY ("content_piece_id") REFERENCES "content_pieces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
