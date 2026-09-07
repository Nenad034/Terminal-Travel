# apps/api (NestJS) — pakovanje za server.
#
# Zasto `bookworm-slim`, a ne manji `alpine`: `argon2` (hesovanje lozinki, M1 §3.1) i Prisma
# engine su NATIVNI moduli. Na Alpine-u (musl libc) se moraju prevoditi iz izvora i lako
# puknu na nadogradnji; na Debian-u rade iz gotovog paketa. Razlika u velicini slike je
# nekoliko desetina MB — nije vredna klase kvarova koju musl donosi.
#
# Gradi se IZ KORENA repozitorijuma (`docker build -f infra/docker/api.Dockerfile .`),
# jer npm workspaces trazi korenski package-lock.json.

# Zajednicka osnova. `openssl` je OBAVEZAN: Prisma bira svoj nativni motor prema verziji
# OpenSSL-a koju nadje na sistemu. U goloj `slim` slici ga NEMA, pa Prisma pretpostavi
# staru 1.1.x, generise motor za nju, i pri pokretanju padne sa
# "Unable to require libquery_engine-debian-openssl-1.1.x.so.node" (Debian 12 ima OpenSSL 3).
# Zato se instalira u OSNOVI — da isti OpenSSL vide i gradnja (gde se motor bira) i
# pokretanje (gde se ucitava). Provereno 7.9.2026: bez ovoga kontejner ne startuje.
FROM node:22-bookworm-slim AS osnova
RUN apt-get update  && apt-get install -y --no-install-recommends openssl ca-certificates  && rm -rf /var/lib/apt/lists/*

FROM osnova AS deps
WORKDIR /repo
# Prvo samo manifesti — sloj sa zavisnostima se kesira dok se one ne promene,
# pa izmena izvornog koda ne izaziva ponovni `npm ci` (par minuta po gradnji).
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/panel/package.json apps/panel/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
RUN npm ci --ignore-scripts

FROM deps AS build
WORKDIR /repo
COPY apps/api apps/api
# `--ignore-scripts` iznad je preskocio i Prisma generisanje — ovde se radi izricito,
# da se tacno vidi sta se izvrsava (isti razlog zbog kog koreni package.json ima
# `allowScripts` spisak).
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build --workspace=apps/api

# Zavisnosti SAMO za pokretanje API-ja.
#
# Zasto zaseban sloj: npm workspaces drzi zavisnosti svih aplikacija na jednom mestu (koreni
# `node_modules`). Kad se on prekopira ceo, u sliku API-ja udje i `next` (202 MB), React Native
# alat, `@swc`... — izmereno 7.9.2026: preko 600 MB koje API nikad ne uvozi. `--workspace`
# instalira zavisnosti tacno jedne aplikacije, a `--omit=dev` izostavlja alat za gradnju.
FROM osnova AS proddeps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/panel/package.json apps/panel/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
RUN npm ci --omit=dev --ignore-scripts --workspace apps/api --include-workspace-root

FROM osnova AS runtime
WORKDIR /repo
ENV NODE_ENV=production
# Ne radi kao root — ako neko probije proces, ne dobija i masinu.
USER node
COPY --from=proddeps --chown=node:node /repo/node_modules node_modules
# Generisani Prisma klijent (i nativni motor uz njega) dolazi iz sloja za gradnju — `prisma`
# alat koji ga pravi je razvojna zavisnost, pa ga u produkcijskom skupu nema.
COPY --from=build --chown=node:node /repo/node_modules/.prisma node_modules/.prisma
COPY --from=build --chown=node:node /repo/apps/api/dist apps/api/dist
COPY --from=build --chown=node:node /repo/apps/api/prisma apps/api/prisma
COPY --from=build --chown=node:node /repo/apps/api/package.json apps/api/
COPY --from=build --chown=node:node /repo/package.json ./
EXPOSE 3000
# `dist/src/main`, ne `dist/main` — tsconfig obuhvata i `prisma/` i `test/`, pa tsc
# podigne koren izlaza za jedan nivo. Skripta `start:prod` je do 7.9.2026 pokazivala na
# pogresno mesto; nije se videlo jer produkcijski rezim nikad nije pokretan.
CMD ["node", "--enable-source-maps", "apps/api/dist/src/main"]
