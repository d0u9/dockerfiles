#!/bin/bash

PLATFORMS=""
PLATFORMS+="linux/amd64"
PLATFORMS+=","
PLATFORMS+="linux/arm64"

echo $PLATFORMS

docker buildx build \
    --push \
    --platform $PLATFORMS \
    -t d0u9/deluge:latest \
    .

