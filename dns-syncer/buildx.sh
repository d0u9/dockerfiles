image=dns-syncer

#    --platform linux/arm64,linux/amd64 \
docker buildx build \
    --platform linux/amd64 \
    --push \
    -t "d0u9/${image}":latest \
    .
