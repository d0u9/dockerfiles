FROM alpine as build

ENV SS_VERSION 3.3.5
RUN apk add --no-cache --virtual .build-deps \
        git \
        autoconf \
        automake \
        build-base \
        c-ares-dev \
        libcap \
        libev-dev \
        libtool \
        libsodium-dev \
        linux-headers \
        mbedtls-dev \
        pcre-dev \
        rng-tools \
    && git clone https://github.com/shadowsocks/shadowsocks-libev.git \
    && cd shadowsocks-libev \
    && git checkout v${SS_VERSION} \
    && git submodule init && git submodule update \
    && ./autogen.sh \
    && ./configure --prefix=/usr --disable-documentation \
    && make -j install \
    && ls /usr/bin/ss-* | xargs -n1 setcap cap_net_bind_service+ep

FROM alpine
COPY --from=build /usr/bin/ss-* /usr/bin/

RUN apk add --no-cache --virtual .runtime-deps \
        c-ares-dev \
        libcap \
        libev-dev \
        libsodium-dev \
        mbedtls-dev \
        rng-tools \
        pcre-dev \
        su-exec \
    && addgroup -g 1998 config \
    && adduser -D -H -u 60000 ss \
    && adduser ss config \
    && ls /usr/bin/ss-* | xargs -n1 setcap cap_net_bind_service+ep

COPY start.sh /usr/bin/
CMD ["/usr/bin/start.sh"]
