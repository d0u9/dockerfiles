#!/bin/sh
# Build and push ghcr.io/d0u9/ai-digest:<version> by hand, the same way the
# workflow does. Needs `docker login ghcr.io` with a token that may write
# packages. Normally a tag `ai-digest/v<version>` builds it in CI instead.
#
#     ./buildx.sh 0.1.0
set -eu

version=${1:?usage: $0 <version>}
cd "$(dirname "$0")"

docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --build-arg AI_DIGEST_VERSION="$version" \
    --push \
    -t ghcr.io/d0u9/ai-digest:"$version" \
    .
