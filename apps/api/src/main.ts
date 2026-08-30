import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Faza 8 (docs/analize/34-FAZA8-BEZBEDNOSNI-PREGLED.md, 29.8.2026, potvrđeno vlasnikom) —
  // sigurnosna HTTP zaglavlja (X-Content-Type-Options, HSTS, X-Frame-Options i sl.), standardan
  // NestJS obrazac. `contentSecurityPolicy: false` je namerno — podrazumevana strogačka CSP
  // pravila lome Swagger UI (`/api/docs`, inline skriptovi koje ta biblioteka sama učitava,
  // poznat problem u NestJS+helmet+Swagger kombinaciji); ovaj servis inače servira isključivo
  // JSON (ne HTML koji CSP štiti), pa je taj kompromis bezbedan ovde.
  app.use(helmet({ contentSecurityPolicy: false }));

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());

  // M1 spec §6: svi endpoint-i dokumentovani OpenAPI semom pre implementacije.
  const config = new DocumentBuilder()
    .setTitle('Terminal API')
    .setDescription('M1 (Core/Identitet) — docs/moduli/M01-core-identitet/02-SPECIFIKACIJA-M1-CORE-IDENTITET.md')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);
}
bootstrap();
