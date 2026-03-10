FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN yarn global add pnpm turbo
WORKDIR /app

COPY . .
RUN turbo prune --scope=@pixel-mentor/api --docker

FROM node:20-alpine AS installer
RUN apk add --no-cache libc6-compat
RUN yarn global add pnpm
WORKDIR /app

COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
RUN pnpm turbo run build --filter=@pixel-mentor/api

FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=installer /app .

CMD ["node", "apps/api/dist/index.js"]
