FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock ./
RUN mkdir packages
RUN mkdir packages/omot-server
RUN mkdir packages/react-tweet-card
RUN mkdir packages/twitter-data-parser
COPY packages/omot-server/package.json packages/omot-server/
COPY packages/react-tweet-card/package.json packages/react-tweet-card/
COPY packages/twitter-data-parser/package.json packages/twitter-data-parser/
RUN yarn --frozen-lockfile;

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED 1
RUN mv packages/omot-server/.env.prod packages/omot-server/.env
RUN yarn workspace omot-server prisma generate;
RUN yarn workspace omot-server build;

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/packages/omot-server/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/packages/omot-server/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/packages/omot-server/.next/static ./packages/omot-server/.next/static

# TODO: fix this, I don't know why next.js don't pack this module to the .next/standalone.
# So I have to copy it manually. This is a workaround.
# Find out why this is happening and fix it.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@bull-board/ui ./node_modules/@bull-board/ui

EXPOSE 3140

ENV PORT 3140
# set hostname to localhost
ENV HOSTNAME "0.0.0.0"

RUN apk add --no-cache dpkg \
    && apk add --no-cache --virtual .gosu-deps \
        ca-certificates \
        dpkg \
        gnupg \
    && dpkgArch="$(dpkg --print-architecture | awk -F- '{ print $NF }')" \
    && wget -O /usr/local/bin/gosu "https://github.com/tianon/gosu/releases/download/1.17/gosu-$dpkgArch" \
    && wget -O /usr/local/bin/gosu.asc "https://github.com/tianon/gosu/releases/download/1.17/gosu-$dpkgArch.asc" \
    && chmod +x /usr/local/bin/gosu \
    && gosu nobody true \
    && apk del .gosu-deps dpkg

WORKDIR /app/packages/omot-server/
COPY --chown=nextjs:nodejs ./docker/docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
