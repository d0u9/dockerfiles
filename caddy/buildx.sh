#!/bin/sh
set -eu

docker buildx build \
    --pull \
    --platform linux/arm64,linux/amd64 \
    --push \
    -t d0u9/caddy-cloudflare:latest \
    .
