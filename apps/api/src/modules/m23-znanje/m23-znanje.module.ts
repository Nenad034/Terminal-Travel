import { Module } from '@nestjs/common';
import { ArticlesController } from './articles/articles.controller';
import { ArticlesService } from './articles/articles.service';
import { ArticleSourcesController } from './article-sources/article-sources.controller';
import { ArticleSourcesService } from './article-sources/article-sources.service';
import { ArticleRevisionsController } from './article-revisions/article-revisions.controller';
import { ArticleRevisionsService } from './article-revisions/article-revisions.service';
import { KnowledgeResearchService } from './knowledge-research/knowledge-research.service';
import { KnowledgeRefreshService } from './refresh-scheduler/knowledge-refresh.service';
import { KnowledgeAssistantController } from './knowledge-assistant/knowledge-assistant.controller';
import { KnowledgeAssistantService } from './knowledge-assistant/knowledge-assistant.service';
import { PublicKnowledgeController } from './public-knowledge/public-knowledge.controller';
import { AuthModule } from '../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../m1-core-identitet/permissions/permissions.module';
import { AuditLogModule } from '../m1-core-identitet/audit-log/audit-log.module';
import { AnthropicClientService } from '../m15-ai-orkestracija/anthropic/anthropic-client.service';
import { OpenAiEmbeddingService } from '../m15-ai-orkestracija/openai/openai-embedding.service';
import { M18OperativniNadzorModule } from '../m18-operativni-nadzor/m18-operativni-nadzor.module';
import { ProductContentImportsModule } from '../m2-katalog-proizvoda/product-content-imports/product-content-imports.module';

// docs/moduli/M23-znanje/28-SPECIFIKACIJA-M23-ZNANJE.md — prvi prolaz implementacije (avgust
// 2026, backend), isti flat-modul obrazac kao M18/M19/M21/M22. AuthModule/PermissionsModule/
// AuditLogModule su standardni. M18OperativniNadzorModule daje AgentInvocationLogService (§7
// logovanje istraživanja/pitanja). ProductContentImportsModule daje ProductContentImportsService
// (§4d most ka M2 kataloga — in-process DI poziv, isti hibridni obrazac kao M13 FactSyncService/
// M21 TicketsService). AnthropicClientService (M15) registrovan lokalno kao sopstveni provider
// (isti princip kao M19/M21/M22 — zavisi samo od globalnog ConfigService).
@Module({
  imports: [AuthModule, PermissionsModule, AuditLogModule, M18OperativniNadzorModule, ProductContentImportsModule],
  controllers: [ArticlesController, ArticleSourcesController, ArticleRevisionsController, KnowledgeAssistantController, PublicKnowledgeController],
  providers: [
    ArticlesService,
    ArticleSourcesService,
    ArticleRevisionsService,
    KnowledgeResearchService,
    KnowledgeRefreshService,
    KnowledgeAssistantService,
    AnthropicClientService,
    OpenAiEmbeddingService,
  ],
})
export class M23ZnanjeModule {}
