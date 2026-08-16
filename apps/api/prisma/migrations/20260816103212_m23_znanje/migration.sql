-- CreateEnum
CREATE TYPE "ArticleSubjectType" AS ENUM ('PRODUCT', 'DESTINATION', 'COUNTRY');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ArticleTranslationSource" AS ENUM ('MANUAL', 'AI_GENERATED');

-- CreateEnum
CREATE TYPE "ArticleSourceType" AS ENUM ('HOTEL_OFFICIAL_WEBSITE', 'HOTEL_SOCIAL_MEDIA', 'GOVERNMENT_OR_TOURISM_BOARD');

-- CreateEnum
CREATE TYPE "ArticleSourceStatus" AS ENUM ('CANDIDATE', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ArticleRevisionTrigger" AS ENUM ('INITIAL_CREATION', 'SCHEDULED_REFRESH', 'QUESTION_GAP');

-- CreateEnum
CREATE TYPE "ArticleRevisionStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ArticleConfidence" AS ENUM ('HIGH', 'LOW', 'NONE');

-- AlterEnum
ALTER TYPE "AgentRole" ADD VALUE 'KNOWLEDGE_AGENT';

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "subject_type" "ArticleSubjectType" NOT NULL,
    "product_id" TEXT,
    "destination_country" TEXT,
    "destination_city" TEXT,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "generated_by" "ContentGeneratedBy" NOT NULL,
    "approved_by" TEXT,
    "share_token" TEXT,
    "last_refreshed_at" TIMESTAMP(3),
    "next_refresh_due_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_translations" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "language_code" "LanguageCode" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "translation_source" "ArticleTranslationSource" NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "article_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_sources" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source_type" "ArticleSourceType" NOT NULL,
    "status" "ArticleSourceStatus" NOT NULL DEFAULT 'CANDIDATE',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_revisions" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "trigger" "ArticleRevisionTrigger" NOT NULL,
    "proposed_translations" JSONB NOT NULL,
    "source_ids" TEXT[],
    "status" "ArticleRevisionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "asked_by" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "answer_text" TEXT,
    "matched_article_ids" TEXT[],
    "confidence" "ArticleConfidence" NOT NULL,
    "was_helpful" BOOLEAN,
    "triggered_revision_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "articles_share_token_key" ON "articles"("share_token");

-- CreateIndex
CREATE UNIQUE INDEX "article_translations_article_id_language_code_key" ON "article_translations"("article_id", "language_code");

-- AddForeignKey
ALTER TABLE "article_translations" ADD CONSTRAINT "article_translations_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_sources" ADD CONSTRAINT "article_sources_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
