# syntax = docker/dockerfile:1

# The app: one Node process serves the built client, /readme/, the API and the
# WebSocket on 0.0.0.0:$PORT (fly.toml sets PORT=8080), and keeps its SQLite
# database on the /data volume. Node 24 runs the server's .ts files directly,
# so only the client needs a build step.

FROM node:24.21.0-slim AS build
WORKDIR /app
RUN npm install -g pnpm@11.9.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN pnpm build

FROM node:24.21.0-slim AS deps
WORKDIR /app
RUN npm install -g pnpm@11.9.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:24.21.0-slim
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json README.md ./
COPY src/server ./src/server
COPY src/shared ./src/shared
COPY docs ./docs
# a small heap keeps the process well inside the 256 MB machine
CMD ["node", "--max-old-space-size=160", "src/server/index.ts"]
