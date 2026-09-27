# ai-digest: see DESIGN.md. Built for linux/amd64 and linux/arm64.

# Pages and the bundled tool are the same for every architecture: build them
# once, natively, not under emulation.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /src
COPY package.json package-lock.json tsconfig.base.json ./
COPY tool/package.json tool/
COPY web/package.json web/
RUN npm ci --no-audit --no-fund
COPY shared shared
COPY tool tool
COPY web web
RUN npm test --workspace tool && npm run build

FROM node:24-alpine
ARG TARGETARCH
# codex from its GitHub release, pinned. The musl build is static.
ARG CODEX_VERSION=0.154.0
ARG AI_DIGEST_VERSION=dev

# git and ssh for archive's push; bubblewrap for codex's sandbox. npm and the
# other package managers are never run here.
RUN apk add --no-cache git openssh-client bubblewrap \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

RUN case "$TARGETARCH" in \
      amd64) arch=x86_64-unknown-linux-musl ;; \
      arm64) arch=aarch64-unknown-linux-musl ;; \
      *) echo "unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac \
 && wget -qO- "https://github.com/openai/codex/releases/download/rust-v${CODEX_VERSION}/codex-${arch}.tar.gz" \
    | tar -xzf - -C /tmp \
 && install -m 0755 "/tmp/codex-${arch}" /usr/local/bin/codex \
 && rm -f "/tmp/codex-${arch}"

COPY --from=build /src/tool/dist/ai-digest.mjs /app/ai-digest.mjs
COPY --from=build /src/tool/assets /app/assets
COPY --from=build /src/web/dist /app/web

# The container runs as the deploying user's uid (compose `user:`), which has
# no home here; codex keeps its login in the mounted /codex.
ENV AI_DIGEST_VERSION=${AI_DIGEST_VERSION} \
    AI_DIGEST_ASSETS=/app/assets \
    CODEX_HOME=/codex \
    HOME=/tmp
ENTRYPOINT ["node", "/app/ai-digest.mjs"]
