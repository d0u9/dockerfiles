#!/bin/bash

PLATFORMS=""
PLATFORMS+="linux/amd64"
PLATFORMS+=","
PLATFORMS+="linux/arm64"
PLATFORMS+=","
PLATFORMS+="linux/386"

docker buildx build \
    --push \
    --platform $PLATFORMS \
    -t d0u9/kcptun-client:latest \
    .
