-- CreateEnum
CREATE TYPE "HelpAudience" AS ENUM ('STAFF', 'SUBAGENT', 'BUSINESS_CLIENT');

-- CreateEnum
CREATE TYPE "HelpArticleStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "HelpAudienceContext" AS ENUM ('STAFF', 'SUBAGENT', 'BUSINESS_CLIENT');

-- CreateEnum
CREATE TYPE "HelpConfidence" AS ENUM ('HIGH', 'LOW', 'NONE');

-- CreateEnum
CREATE TYPE "HelpArticleSuggestionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "AgentRole" ADD VALUE 'HELP_CENTER_AGENT';

-- CreateTable
CREATE TABLE "help_articles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "audience" "HelpAudience"[],
    "related_module" TEXT,
    "is_critical_example" BOOLEAN NOT NULL DEFAULT false,
    "status" "HelpArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "generated_by" "ContentGeneratedBy" NOT NULL,
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "help_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_article_translations" (
    "id" TEXT NOT NULL,
    "help_article_id" TEXT NOT NULL,
    "language_code" "LanguageCode" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "help_article_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_questions" (
    "id" TEXT NOT NULL,
    "asked_by" TEXT NOT NULL,
    "audience_context" "HelpAudienceContext" NOT NULL,
    "question_text" TEXT NOT NULL,
    "answer_text" TEXT,
    "matched_article_ids" TEXT[],
    "confidence" "HelpConfidence" NOT NULL,
    "was_helpful" BOOLEAN,
    "escalated_ticket_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_article_suggestions" (
    "id" TEXT NOT NULL,
    "based_on_question_ids" TEXT[],
    "draft_title" TEXT NOT NULL,
    "draft_body" TEXT NOT NULL,
    "status" "HelpArticleSuggestionStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "help_article_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "help_articles_slug_key" ON "help_articles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "help_article_translations_help_article_id_language_code_key" ON "help_article_translations"("help_article_id", "language_code");

-- AddForeignKey
ALTER TABLE "help_article_translations" ADD CONSTRAINT "help_article_translations_help_article_id_fkey" FOREIGN KEY ("help_article_id") REFERENCES "help_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
