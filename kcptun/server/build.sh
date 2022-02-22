#!/bin/bash

docker buildx build \
    --push \
    --platform linux/amd64,linux/arm64 \
    -t d0u9/kcptun-server:latest \
    .
