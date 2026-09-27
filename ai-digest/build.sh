#!/bin/sh
# Build ai-digest:<version> for this machine's architecture only, into the
# local image store, without pushing. For trying the image on a server
# before publishing it with buildx.sh.
#
#     ./build.sh            # ai-digest:dev
#     ./build.sh 0.1.0      # ai-digest:0.1.0
set -eu

version=${1:-dev}
cd "$(dirname "$0")"

docker build \
    --build-arg AI_DIGEST_VERSION="$version" \
    -t ai-digest:"$version" \
    .
