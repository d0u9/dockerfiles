FROM alpine as builder

RUN set -e; \
    apk add --no-cache \
        jq \
        wget \
        curl \
        ;

ARG TARGETPLATFORM
RUN set -e; \
    mkdir -p /build/bin; cd /build; \
    tag=$(curl -s https://api.github.com/repos/shadowsocks/shadowsocks-rust/releases/latest | jq .name -r); \
    pkg="shadowsocks-${tag}.$(uname -m)-unknown-linux-musl.tar.xz"; \
    wget https://github.com/shadowsocks/shadowsocks-rust/releases/download/${tag}/${pkg} -O ss.tar.xz; \
    tar -xf ss.tar.xz -C bin; \
    :;

# Install v2ray plugin
RUN set -e; \
    mkdir -p /build/bin; cd /build; \
    tag=$(curl -s https://api.github.com/repos/shadowsocks/v2ray-plugin/releases/latest | jq .name -r); \
    pkg="v2ray-plugin-${TARGETPLATFORM//\//-}-${tag}.tar.gz" ; \
    wget https://github.com/shadowsocks/v2ray-plugin/releases/download/${tag}/${pkg} -O v2ray.tar.xz; \
    tar -xf v2ray.tar.xz -C bin; \
    mv bin/v2ray-plugin* bin/v2ray-plugin; \
    :;

# Install simple-obf
RUN set -e; \
    apk add --no-cache \
        git \
        gcc autoconf make libtool automake zlib-dev openssl asciidoc xmlto libpcre32 libev-dev g++ linux-headers \
        ;

RUN set -e; \
    mkdir -p /build/bin; cd /build; \
    git clone https://github.com/shadowsocks/simple-obfs.git ; \
    cd simple-obfs ; \
    git submodule update --init --recursive ; \
    ./autogen.sh ; \
    ./configure --prefix=/build --enable-static ; \
    make ; \
    make install ; \
    :;

FROM alpine
COPY --from=builder /build/bin/* /usr/local/bin

ARG UID=3004
ARG GID=3004

RUN set -e; \
    apk add --no-cache libev ; \
    addgroup -g ${GID} ss; \
    adduser -H -D -G ss -u ${UID} ss; \
    :;

USER ss:ss
WORKDIR /config

COPY docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["ss"]
