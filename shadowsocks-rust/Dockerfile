FROM alpine as builder

RUN set -e; \
    apk add --no-cache --virtual .build-deps \
    jq \
    wget \
    curl \
    ;

RUN set -e; \
    mkdir -p /build/bin; cd /build; \
    tag=$(curl -s https://api.github.com/repos/shadowsocks/shadowsocks-rust/releases/latest | jq .name -r); \
    wget https://github.com/shadowsocks/shadowsocks-rust/releases/download/$tag/shadowsocks-$tag.x86_64-unknown-linux-musl.tar.xz -O ss.tar.xz; \
    tar -xf ss.tar.xz -C bin; \
    :;

FROM alpine

COPY --from=builder /build/bin/* /usr/local/bin
COPY docker-entrypoint.sh /usr/local/bin/

RUN set -e; \
    addgroup -g 1000 ss; \
    adduser -H -D -G ss -u 1000 ss; \
    :;

USER ss:ss

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["ss"]

