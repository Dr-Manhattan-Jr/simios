FROM node:24-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.27.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json eslint.config.js ./
COPY apps/los_piratas_bot/package.json apps/los_piratas_bot/
COPY packages/env/package.json packages/env/
COPY packages/telegram-kit/package.json packages/telegram-kit/

RUN pnpm install --frozen-lockfile

COPY apps/los_piratas_bot apps/los_piratas_bot
COPY packages packages

ENV NODE_OPTIONS=--max-old-space-size=4096

RUN pnpm -F @simios/env build \
 && pnpm -F @simios/telegram-kit build \
 && pnpm -F los_piratas_bot build

RUN pnpm --filter=los_piratas_bot --prod --legacy deploy /app/deploy


FROM node:24-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@10.27.0 --activate

WORKDIR /app

COPY --from=builder /app/deploy ./

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
