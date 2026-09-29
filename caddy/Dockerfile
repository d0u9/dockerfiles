ARG CADDY_VERSION=2

# The builder runs on the build host's own architecture and cross-compiles for
# the target, instead of compiling under QEMU emulation, which is several times
# slower for the non-native platform.
FROM --platform=$BUILDPLATFORM caddy:${CADDY_VERSION}-builder AS build
ARG TARGETOS TARGETARCH
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH CGO_ENABLED=0 \
    xcaddy build --with github.com/caddy-dns/cloudflare

# The builder image carries only the toolchain; the default Caddyfile and
# welcome page come from the official runtime image.
FROM caddy:${CADDY_VERSION} AS official

# The official caddy image declares EXPOSE 80 443 443/udp 2019, and a Dockerfile
# cannot remove an inherited EXPOSE. The runtime stage is therefore rebuilt on
# Alpine, following the official image, with only the HTTPS ports declared.
FROM alpine:3

LABEL org.opencontainers.image.title="Caddy with Cloudflare DNS" \
      org.opencontainers.image.description="Caddy with the caddy-dns/cloudflare module for ACME DNS-01"

RUN set -eux; \
    apk upgrade --no-cache; \
    apk add --no-cache ca-certificates libcap mailcap; \
    mkdir -p /config/caddy /data/caddy /etc/caddy /usr/share/caddy

COPY --from=build /usr/bin/caddy /usr/bin/caddy
COPY --from=official /etc/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=official /usr/share/caddy/index.html /usr/share/caddy/index.html

RUN set -eux; \
    setcap cap_net_bind_service=+ep /usr/bin/caddy; \
    caddy list-modules | grep -qx 'dns.providers.cloudflare'

ENV XDG_CONFIG_HOME=/config \
    XDG_DATA_HOME=/data

VOLUME ["/config", "/data"]

# DNS-01 needs no inbound port, so 80 (HTTP-01) is not declared. 2019 is the
# admin API, which listens on localhost inside the container.
EXPOSE 443/tcp 443/udp

WORKDIR /srv

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
