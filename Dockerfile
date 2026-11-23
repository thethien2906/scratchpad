FROM node:20-alpine AS frontend-builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM rust:1-bookworm AS backend-builder

WORKDIR /app/server
COPY server/Cargo.toml server/Cargo.lock ./
RUN mkdir src \
    && printf 'fn main() {}\n' > src/main.rs \
    && cargo build --release --locked \
    && rm -rf src

COPY server/src ./src
RUN cargo build --release --locked

FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/data \
    && chown -R 1000:1000 /app/data

WORKDIR /app
COPY --from=backend-builder /app/server/target/release/erwining-server /app/erwining-server
COPY --from=frontend-builder /app/dist /app/dist

ENV PORT=8080 \
    DATABASE_PATH=/app/data/erwining.db \
    STATIC_DIR=/app/dist \
    COOKIE_SECURE=false \
    SESSION_TTL_DAYS=30 \
    ADMIN_SECRET=create_profile

EXPOSE 8080
USER 1000:1000
CMD ["/app/erwining-server"]
