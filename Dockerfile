# Build-only image. The frontend is static files — Caddy serves them directly,
# so there is no Node process in production and no container to keep alive.
#
#   docker build --target dist --output type=local,dest=./dist .
#
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# 1 vCPU / 2GB box: cap the heap so a build can't invoke the OOM killer on
# containers belonging to other apps.
ENV NODE_OPTIONS=--max-old-space-size=768
RUN npm run build

# Export stage: contains nothing but dist/, so --output writes just that.
FROM scratch AS dist
COPY --from=build /app/dist /
