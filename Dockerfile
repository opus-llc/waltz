# waltz 本番イメージ
# データ（SQLite と画像）は /data に保存する。ボリュームをマウントして使う。
FROM node:24-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
# サブディレクトリに置く場合（例: /demo）と、前段の中継サーバーのドメイン。どちらもビルド時に固定される
ARG NEXT_PUBLIC_BASE_PATH=""
ARG SERVER_ACTIONS_ALLOWED_ORIGINS=""
# 記事の URL の置き場（既定 articles ＝ /articles/{slug}。空文字で /{slug}）
ARG NEXT_PUBLIC_ARTICLE_PATH="articles"
# 前段の中継が ?_rsc=… を落とすときだけ off（next.config.ts の validateRSCRequestHeaders の説明）
ARG RSC_PARAM_CHECK=""
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH SERVER_ACTIONS_ALLOWED_ORIGINS=$SERVER_ACTIONS_ALLOWED_ORIGINS NEXT_PUBLIC_ARTICLE_PATH=$NEXT_PUBLIC_ARTICLE_PATH RSC_PARAM_CHECK=$RSC_PARAM_CHECK
COPY . .
RUN npm run build && npm run build:seed && npm run build:import

FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/data
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/dist/seed.cjs ./seed.cjs
COPY --from=build /app/dist/import-wordpress.cjs ./import-wordpress.cjs
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY docker-entrypoint.sh ./
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
