-- pgvector ekstenzija (docker-compose.yml sad koristi pgvector/pgvector:pg16 sliku koja je nosi
-- ugrađenu, ali još nije aktivirana u ovoj bazi dok se eksplicitno ne kreira).
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "article_translations" ADD COLUMN     "embedding" vector(1536);

-- AlterTable
ALTER TABLE "help_article_translations" ADD COLUMN     "embedding" vector(1536);
