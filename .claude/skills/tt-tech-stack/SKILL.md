---
name: tt-tech-stack
description: Terminal Travel tehnički stek — TypeScript, NestJS, PostgreSQL, Prisma, REST/OpenAPI, Next.js, EU hosting i obrazloženje svakog izbora (poglavlje 6 master dokumenta i 01-OBJASNJENJE-TEHNICKOG-STEKA.md). Učitaj pre uvođenja nove biblioteke/frameworka/patterna ili kad treba objasniti zašto je nešto izabrano.
---

# Terminal Travel — tehnički stek

Pointer-skill — pravi sadržaj je u `00-MASTER-ARHITEKTURA.md` poglavlje 6 (tabela izbora + obrazloženje) i u `01-OBJASNJENJE-TEHNICKOG-STEKA.md` (isto objašnjeno bez žargona, za vlasnika koji nije programer).

## Kad koristiti ovaj skill

- Pre nego što predložiš ili uvedeš novu biblioteku, framework ili arhitektonski pattern.
- Kad treba objasniti vlasniku (Nenad — arhitekta, ne programer) zašto je nešto izabrano ili koji su kompromisi.
- Kad zadatak deluje kao da zahteva izlazak iz steka (npr. druga baza, drugi ORM, drugi frontend framework) — ovo je crvena zastavica, stani i proveri poglavlje 6 pre nastavka.

## Tekući izbori (detalji i obrazloženje u poglavlju 6)

TypeScript svuda · NestJS (backend) · PostgreSQL · Prisma (potvrđeno nad Drizzle-om, jul 2026) · REST + OpenAPI između modula i kanala · Event Bus (LISTEN/NOTIFY ili Redis Pub/Sub, kasnije RabbitMQ/Kafka) · Next.js (svi kanali, self-hosted Node.js na EU cloud infrastrukturi — namerno bez Vercel-ekskluzivnih funkcija zbog US CLOUD Act / EU-U.S. Data Privacy Framework) · self-hosted IAM (Keycloak ili Auth.js) za RBAC · EU cloud regija, infrastruktura kao kod · Turborepo/Nx monorepo · obavezni automatski testovi + CI koji ne pušta kod bez prolaska testova.

## Tvrdo pravilo (iz CLAUDE.md)

Ne uvoditi novu tehnologiju/biblioteku/pattern koji nije u poglavlju 6 bez izričite potvrde vlasnika — promena steka nosi realnu cenu. Ako zadatak deluje da zahteva odstupanje, stani, obrazloži zašto (jasna preporuka sa obrazloženjem, ne samo lista opcija — vlasnik ne može sam da proceni tehnički kompromis), i traži potvrdu pre pisanja koda.
