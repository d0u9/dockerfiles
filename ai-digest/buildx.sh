#!/bin/sh
# Build d0u9/ai-digest:<version> for linux/amd64 and linux/arm64 and push it,
# with :latest, to Docker Hub. Needs `docker login` with an account that may
# write d0u9/ai-digest, and a buildx builder that can run arm64 (QEMU on an
# amd64 host). A tag `ai-digest/v<version>` builds the same image in GitHub
# Actions and pushes it to ghcr.io instead.
#
#     ./buildx.sh 0.1.0
set -eu

version=${1:?usage: $0 <version>}
cd "$(dirname "$0")"

docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --build-arg AI_DIGEST_VERSION="$version" \
    --push \
    -t d0u9/ai-digest:"$version" \
    -t d0u9/ai-digest:latest \
    .
