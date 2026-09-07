# apps/web (Next.js) — pakovanje za server.
#
# Koristi `output: 'standalone'` iz next.config.mjs: Next tada sam sklopi minimalan
# folder sa samo onim node_modules koje kod stvarno uvozi. Bez toga bi u sliku islo
# celo stablo zavisnosti monorepa (visestruko vece, i sporije se salje na server).
#
# Gradi se IZ KORENA repozitorijuma (`docker build -f infra/docker/web.Dockerfile .`).

FROM node:22-bookworm-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/panel/package.json apps/panel/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
RUN npm ci --ignore-scripts

FROM deps AS build
WORKDIR /repo
# Panel i sajt uvoze tipove iz @prisma/client (isti razlog zbog kog to radi i CI) —
# bez generisanog klijenta `next build` pada na proveri tipova.
COPY apps/api/prisma apps/api/prisma
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=apps/web

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
USER node
# Tri dela standalone izlaza: server + zavisnosti, staticki fajlovi, i `public/`.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
