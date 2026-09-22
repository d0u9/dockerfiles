image=dnsmasq

docker buildx build \
    --platform linux/arm64,linux/amd64 \
    --push \
    -t "d0u9/${image}":latest \
    .
