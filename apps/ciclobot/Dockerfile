FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.27.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json eslint.config.js ./
COPY apps/ciclobot/package.json apps/ciclobot/
COPY packages/env/package.json packages/env/
COPY packages/sheets-client/package.json packages/sheets-client/
COPY packages/telegram-kit/package.json packages/telegram-kit/

RUN pnpm install --frozen-lockfile

COPY apps/ciclobot apps/ciclobot
COPY packages packages

ENV NODE_OPTIONS=--max-old-space-size=4096

RUN pnpm -F @simios/env build \
 && pnpm -F @simios/sheets-client build \
 && pnpm -F @simios/telegram-kit build \
 && pnpm -F ciclobot build

RUN pnpm --filter=ciclobot --prod --legacy deploy /app/deploy


FROM node:20-alpine AS runtime

WORKDIR /app

COPY --from=builder /app/deploy ./

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
