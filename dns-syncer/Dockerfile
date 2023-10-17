FROM rust:alpine as builder

RUN set -e; \
    apk add --no-cache \
        git \
        openssl-dev \
        openssl-libs-static \
        musl-dev \
        ; \
    git clone https://github.com/d0u9/dns-syncer-rs.git ; \
    cd dns-syncer-rs ; \
    host=$(rustc -vV | sed -n 's/^host: \(.*\)/\1/p') ; \
    RUSTFLAGS='-C target-feature=+crt-static' cargo build --target $host --release ; \
    cp target/x86_64-unknown-linux-musl/release/dns-syncer-rs /usr/local/bin/ ; \
    :;

FROM alpine
COPY --from=builder /usr/local/bin/dns-syncer-rs /usr/local/bin/dns-syncer

ARG UID=3004
ARG GID=3004

RUN set -e; \
    addgroup -g ${GID} dns-syncer; \
    adduser -H -D -G dns-syncer -u ${UID} dns-syncer; \
    :;

USER dns-syncer:dns-syncer
WORKDIR /config

COPY docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["dns-syncer"]
