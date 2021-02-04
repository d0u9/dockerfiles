FROM alpine as build

ENV TROJAN_VERSION 1.16.0
RUN apk add --no-cache --virtual .build-deps \
        wget \
        tar \
        build-base \
        cmake \
        boost-dev \
        openssl-dev \
        mariadb-connector-c-dev \
    && wget -nv -O - https://github.com/trojan-gfw/trojan/archive/v${TROJAN_VERSION}.tar.gz | tar -zx \
    && (cd trojan-${TROJAN_VERSION} && cmake . && make -j $(nproc) && strip -s trojan \
    && mv trojan /usr/bin)

FROM alpine
COPY --from=build /usr/bin/trojan /usr/bin/trojan

RUN apk add --no-cache --virtual .runtime-deps \
        libcap \
        libstdc++ \
        boost-system \
        boost-program_options \
        mariadb-connector-c \
        su-exec \
    && addgroup -g 1999 cert \
    && addgroup -g 1998 config \
    && adduser -D -H -u 60002 trojan \
    && adduser trojan cert \
    && adduser trojan config \
    && setcap cap_net_bind_service+ep /usr/bin/trojan

WORKDIR /config
COPY start.sh /usr/bin/
CMD ["/usr/bin/start.sh"]
