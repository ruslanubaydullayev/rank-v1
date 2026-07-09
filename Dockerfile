# syntax=docker/dockerfile:1

# Backend image for the Hetzner VPS: Nitro server + the render pipeline binaries.
FROM node:22-bookworm-slim

# System deps:
#  - ffmpeg/ffprobe: video normalization + rendering
#  - curl/ca-certificates: fetch the yt-dlp binary
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# yt-dlp standalone binary (bundles its own Python runtime).
RUN curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp

# pnpm via corepack (version pinned by package.json "packageManager").
RUN corepack enable

WORKDIR /app

# Copy source then install so the "nuxt prepare" postinstall has the app context.
# Dev deps are kept on purpose: drizzle-kit runs migrations at container start.
COPY . .
RUN pnpm install --frozen-lockfile

# Build the Node server output (.output/server/index.mjs).
ENV NITRO_PRESET=node-server
RUN pnpm build

ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
EXPOSE 3000

# Apply pending DB migrations, then start the server.
CMD ["sh", "-c", "pnpm db:migrate && node .output/server/index.mjs"]
