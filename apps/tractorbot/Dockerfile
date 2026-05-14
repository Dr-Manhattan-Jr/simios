FROM node:24-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.27.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json eslint.config.js ./
COPY apps/tractorbot/package.json apps/tractorbot/
COPY packages/env/package.json packages/env/
COPY packages/telegram-kit/package.json packages/telegram-kit/

RUN pnpm install --frozen-lockfile

COPY apps/tractorbot apps/tractorbot
COPY packages packages

ENV NODE_OPTIONS=--max-old-space-size=4096

RUN pnpm -F @simios/env build \
 && pnpm -F @simios/telegram-kit build \
 && pnpm -F tractorbot build

RUN pnpm --filter=tractorbot --prod --legacy deploy /app/deploy


FROM node:24-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@10.27.0 --activate

WORKDIR /app

COPY --from=builder /app/deploy ./

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
